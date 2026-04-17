from datetime import date, datetime, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException
from sqlalchemy import select, func, and_
from pydantic import BaseModel
from app.dependencies import CurrentRestaurant, CurrentUser, DB
from app.models.accounting import Account, JournalEntry, JournalLine, Expense, VendorInvoice
from app.models.order import Order

router = APIRouter(prefix="/accounting", tags=["accounting"])


class AccountCreate(BaseModel):
    name: str
    type: str  # asset|liability|equity|revenue|expense
    code: Optional[str] = None
    description: Optional[str] = None


class ExpenseCreate(BaseModel):
    category: str
    amount: float
    description: str
    vendor: Optional[str] = None
    expense_date: date
    notes: Optional[str] = None


class InvoiceCreate(BaseModel):
    supplier_id: Optional[str] = None
    invoice_number: str
    amount: float
    tax_amount: float = 0.0
    due_date: date
    notes: Optional[str] = None


@router.get("/accounts")
async def list_accounts(restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(select(Account).where(Account.restaurant_id == restaurant.id, Account.is_active == True).order_by(Account.type, Account.code))
    return result.scalars().all()


@router.post("/accounts", status_code=201)
async def create_account(body: AccountCreate, restaurant: CurrentRestaurant, db: DB):
    account = Account(restaurant_id=restaurant.id, **body.model_dump())
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


@router.get("/expenses")
async def list_expenses(
    restaurant: CurrentRestaurant,
    db: DB,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    category: Optional[str] = None,
):
    query = select(Expense).where(Expense.restaurant_id == restaurant.id)
    if start_date:
        query = query.where(Expense.expense_date >= start_date)
    if end_date:
        query = query.where(Expense.expense_date <= end_date)
    if category:
        query = query.where(Expense.category == category)
    query = query.order_by(Expense.expense_date.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/expenses", status_code=201)
async def create_expense(body: ExpenseCreate, current_user: CurrentUser, restaurant: CurrentRestaurant, db: DB):
    expense = Expense(restaurant_id=restaurant.id, created_by=current_user.id, **body.model_dump())
    db.add(expense)
    await db.commit()
    await db.refresh(expense)
    return expense


@router.get("/invoices")
async def list_invoices(restaurant: CurrentRestaurant, db: DB, status: Optional[str] = None):
    query = select(VendorInvoice).where(VendorInvoice.restaurant_id == restaurant.id)
    if status:
        query = query.where(VendorInvoice.status == status)
    result = await db.execute(query.order_by(VendorInvoice.due_date))
    return result.scalars().all()


@router.post("/invoices", status_code=201)
async def create_invoice(body: InvoiceCreate, restaurant: CurrentRestaurant, db: DB):
    invoice = VendorInvoice(restaurant_id=restaurant.id, **body.model_dump())
    db.add(invoice)
    await db.commit()
    await db.refresh(invoice)
    return invoice


@router.patch("/invoices/{invoice_id}/pay")
async def pay_invoice(invoice_id: str, amount: float, restaurant: CurrentRestaurant, db: DB):
    result = await db.execute(select(VendorInvoice).where(VendorInvoice.id == invoice_id, VendorInvoice.restaurant_id == restaurant.id))
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Not found")
    invoice.paid_amount += amount
    if invoice.paid_amount >= invoice.amount:
        invoice.status = "paid"
        invoice.paid_at = datetime.now()
    else:
        invoice.status = "partial"
    await db.commit()
    return invoice


@router.get("/pl-report")
async def pl_report(
    restaurant: CurrentRestaurant,
    db: DB,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
):
    if not start_date:
        start_date = (datetime.now() - timedelta(days=30)).date()
    if not end_date:
        end_date = datetime.now().date()

    start_dt = datetime.combine(start_date, datetime.min.time())
    end_dt = datetime.combine(end_date, datetime.max.time())

    # Revenue from completed orders
    rev_result = await db.execute(
        select(func.sum(Order.subtotal)).where(
            Order.restaurant_id == restaurant.id,
            Order.status == "completed",
            Order.created_at.between(start_dt, end_dt),
        )
    )
    revenue = float(rev_result.scalar() or 0)

    # Expenses by category
    exp_result = await db.execute(
        select(Expense.category, func.sum(Expense.amount)).where(
            Expense.restaurant_id == restaurant.id,
            Expense.expense_date.between(start_date, end_date),
        ).group_by(Expense.category)
    )
    expenses_by_cat = {row[0]: float(row[1] or 0) for row in exp_result.all()}
    total_expenses = sum(expenses_by_cat.values())
    net_profit = revenue - total_expenses

    return {
        "period": {"start": str(start_date), "end": str(end_date)},
        "revenue": round(revenue, 2),
        "expenses": expenses_by_cat,
        "total_expenses": round(total_expenses, 2),
        "net_profit": round(net_profit, 2),
        "profit_margin": round((net_profit / revenue * 100) if revenue > 0 else 0, 2),
    }


@router.get("/cash-flow")
async def cash_flow(restaurant: CurrentRestaurant, db: DB, days: int = 30):
    now = datetime.now()
    start = now - timedelta(days=days)

    rev_result = await db.execute(
        select(func.date(Order.created_at).label("d"), func.sum(Order.total).label("rev")).where(
            Order.restaurant_id == restaurant.id, Order.status == "completed", Order.created_at >= start
        ).group_by(func.date(Order.created_at)).order_by(func.date(Order.created_at))
    )
    exp_result = await db.execute(
        select(Expense.expense_date, func.sum(Expense.amount)).where(
            Expense.restaurant_id == restaurant.id, Expense.expense_date >= start.date()
        ).group_by(Expense.expense_date).order_by(Expense.expense_date)
    )

    revenue_by_date = {str(r.d): float(r.rev or 0) for r in rev_result.all()}
    expenses_by_date = {str(r[0]): float(r[1] or 0) for r in exp_result.all()}

    all_dates = sorted(set(list(revenue_by_date.keys()) + list(expenses_by_date.keys())))
    return [
        {
            "date": d,
            "revenue": revenue_by_date.get(d, 0),
            "expenses": expenses_by_date.get(d, 0),
            "net": revenue_by_date.get(d, 0) - expenses_by_date.get(d, 0),
        }
        for d in all_dates
    ]
