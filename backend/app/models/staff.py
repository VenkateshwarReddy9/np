import uuid
from datetime import datetime, date, time
from sqlalchemy import String, DateTime, Date, Time, Float, Integer, Boolean, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Employee(Base):
    __tablename__ = "employees"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    restaurant_id: Mapped[str] = mapped_column(String(36), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), unique=True)
    position: Mapped[str] = mapped_column(String(100), nullable=False)
    # role: manager|cashier|server|cook|dishwasher|host|bartender
    role: Mapped[str] = mapped_column(String(50), nullable=False)
    hourly_rate: Mapped[float] = mapped_column(Float, default=0.0)
    overtime_rate: Mapped[float | None] = mapped_column(Float)
    hire_date: Mapped[date | None] = mapped_column(Date)
    # status: active|inactive|terminated
    status: Mapped[str] = mapped_column(String(20), default="active")
    emergency_name: Mapped[str | None] = mapped_column(String(200))
    emergency_phone: Mapped[str | None] = mapped_column(String(30))
    certifications: Mapped[str | None] = mapped_column(Text)  # JSON list
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user: Mapped["User | None"] = relationship("User")  # noqa: F821
    availability: Mapped[list["EmployeeAvailability"]] = relationship("EmployeeAvailability", back_populates="employee", cascade="all, delete-orphan")
    shifts: Mapped[list["Shift"]] = relationship("Shift", back_populates="employee")
    time_entries: Mapped[list["TimeEntry"]] = relationship("TimeEntry", back_populates="employee")


class EmployeeAvailability(Base):
    __tablename__ = "employee_availability"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    employee_id: Mapped[str] = mapped_column(String(36), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)  # 0=Mon, 6=Sun
    start_time: Mapped[time | None] = mapped_column(Time)
    end_time: Mapped[time | None] = mapped_column(Time)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)

    employee: Mapped["Employee"] = relationship("Employee", back_populates="availability")


class Shift(Base):
    __tablename__ = "shifts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    restaurant_id: Mapped[str] = mapped_column(String(36), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False)
    employee_id: Mapped[str] = mapped_column(String(36), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False)
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    # status: scheduled|confirmed|in_progress|completed|no_show|swapped
    status: Mapped[str] = mapped_column(String(20), default="scheduled")
    notes: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    employee: Mapped["Employee"] = relationship("Employee", back_populates="shifts")
    swap_requests: Mapped[list["ShiftSwapRequest"]] = relationship("ShiftSwapRequest", back_populates="shift", cascade="all, delete-orphan")
    time_entry: Mapped["TimeEntry | None"] = relationship("TimeEntry", back_populates="shift", uselist=False)


class ShiftSwapRequest(Base):
    __tablename__ = "shift_swap_requests"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    shift_id: Mapped[str] = mapped_column(String(36), ForeignKey("shifts.id", ondelete="CASCADE"), nullable=False)
    requester_id: Mapped[str] = mapped_column(String(36), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    target_employee_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("employees.id", ondelete="SET NULL"))
    # status: pending|accepted|rejected|cancelled
    status: Mapped[str] = mapped_column(String(20), default="pending")
    manager_notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    shift: Mapped["Shift"] = relationship("Shift", back_populates="swap_requests")


class TimeEntry(Base):
    __tablename__ = "time_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    restaurant_id: Mapped[str] = mapped_column(String(36), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False)
    employee_id: Mapped[str] = mapped_column(String(36), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    shift_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("shifts.id", ondelete="SET NULL"), unique=True)
    clock_in: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    clock_out: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    break_minutes: Mapped[int] = mapped_column(Integer, default=0)
    total_hours: Mapped[float | None] = mapped_column(Float)
    overtime_hours: Mapped[float] = mapped_column(Float, default=0.0)
    notes: Mapped[str | None] = mapped_column(Text)
    approved_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    employee: Mapped["Employee"] = relationship("Employee", back_populates="time_entries")
    shift: Mapped["Shift | None"] = relationship("Shift", back_populates="time_entry")


class PayrollPeriod(Base):
    __tablename__ = "payroll_periods"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    restaurant_id: Mapped[str] = mapped_column(String(36), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    # status: draft|approved|paid
    status: Mapped[str] = mapped_column(String(20), default="draft")
    total_amount: Mapped[float] = mapped_column(Float, default=0.0)
    run_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"))
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    entries: Mapped[list["PayrollEntry"]] = relationship("PayrollEntry", back_populates="period", cascade="all, delete-orphan")


class PayrollEntry(Base):
    __tablename__ = "payroll_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    period_id: Mapped[str] = mapped_column(String(36), ForeignKey("payroll_periods.id", ondelete="CASCADE"), nullable=False)
    employee_id: Mapped[str] = mapped_column(String(36), ForeignKey("employees.id", ondelete="RESTRICT"), nullable=False)
    regular_hours: Mapped[float] = mapped_column(Float, default=0.0)
    overtime_hours: Mapped[float] = mapped_column(Float, default=0.0)
    regular_pay: Mapped[float] = mapped_column(Float, default=0.0)
    overtime_pay: Mapped[float] = mapped_column(Float, default=0.0)
    tips: Mapped[float] = mapped_column(Float, default=0.0)
    deductions: Mapped[float] = mapped_column(Float, default=0.0)
    gross_pay: Mapped[float] = mapped_column(Float, default=0.0)
    net_pay: Mapped[float] = mapped_column(Float, default=0.0)
    notes: Mapped[str | None] = mapped_column(Text)

    period: Mapped["PayrollPeriod"] = relationship("PayrollPeriod", back_populates="entries")
    employee: Mapped["Employee"] = relationship("Employee")
