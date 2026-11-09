
from datetime import date
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func

import models
from database import get_db
from auth import get_current_user


router = APIRouter(
    prefix="/farm-finance",
    tags=["Farm Finance"]
)


# -------------------------------
# PYDANTIC SCHEMAS
# -------------------------------

class ExpenseCreate(BaseModel):
    crop_name: str = Field(..., min_length=1)
    category: str = Field(..., min_length=1)
    amount: Decimal = Field(..., gt=0)
    expense_date: date
    description: Optional[str] = None


class IncomeCreate(BaseModel):
    crop_name: str = Field(..., min_length=1)
    quantity: Decimal = Field(..., gt=0)
    unit: str = Field(..., min_length=1)
    selling_price: Decimal = Field(..., gt=0)
    sale_date: date
    buyer_name: Optional[str] = None
    description: Optional[str] = None


# -------------------------------
# HELPER FUNCTIONS
# -------------------------------

def expense_to_dict(expense):
    return {
        "id": expense.id,
        "crop_name": expense.crop_name,
        "category": expense.category,
        "amount": float(expense.amount),
        "expense_date": expense.expense_date.isoformat(),
        "description": expense.description,
    }


def income_to_dict(income):
    return {
        "id": income.id,
        "crop_name": income.crop_name,
        "quantity": float(income.quantity),
        "unit": income.unit,
        "selling_price": float(income.selling_price),
        "total_amount": float(income.total_amount),
        "sale_date": income.sale_date.isoformat(),
        "buyer_name": income.buyer_name,
        "description": income.description,
    }


# -------------------------------
# FINANCIAL SUMMARY
# -------------------------------

@router.get("/summary")
def get_finance_summary(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    expenses = (
        db.query(func.coalesce(func.sum(models.FarmExpense.amount), 0))
        .filter(models.FarmExpense.owner_id == current_user.id)
        .scalar()
    )

    income = (
        db.query(func.coalesce(func.sum(models.FarmIncome.total_amount), 0))
        .filter(models.FarmIncome.owner_id == current_user.id)
        .scalar()
    )

    total_expenses = Decimal(str(expenses or 0))
    total_income = Decimal(str(income or 0))
    profit = total_income - total_expenses

    expense_rows = (
        db.query(
            models.FarmExpense.crop_name,
            func.sum(models.FarmExpense.amount).label("total_expenses")
        )
        .filter(models.FarmExpense.owner_id == current_user.id)
        .group_by(models.FarmExpense.crop_name)
        .all()
    )

    income_rows = (
        db.query(
            models.FarmIncome.crop_name,
            func.sum(models.FarmIncome.total_amount).label("total_income")
        )
        .filter(models.FarmIncome.owner_id == current_user.id)
        .group_by(models.FarmIncome.crop_name)
        .all()
    )

    crop_data = {}

    for row in expense_rows:
        crop_data[row.crop_name] = {
            "crop_name": row.crop_name,
            "total_income": 0.0,
            "total_expenses": float(row.total_expenses or 0),
            "profit": 0.0
        }

    for row in income_rows:
        if row.crop_name not in crop_data:
            crop_data[row.crop_name] = {
                "crop_name": row.crop_name,
                "total_income": 0.0,
                "total_expenses": 0.0,
                "profit": 0.0
            }

        crop_data[row.crop_name]["total_income"] = float(
            row.total_income or 0
        )

    for crop in crop_data.values():
        crop["profit"] = (
            crop["total_income"] - crop["total_expenses"]
        )

    return {
        "total_income": float(total_income),
        "total_expenses": float(total_expenses),
        "profit": float(profit),
        "status": "Profit" if profit >= 0 else "Loss",
        "crop_analysis": list(crop_data.values())
    }


# -------------------------------
# EXPENSE MANAGEMENT
# -------------------------------

@router.get("/expenses")
def get_expenses(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    records = (
        db.query(models.FarmExpense)
        .filter(models.FarmExpense.owner_id == current_user.id)
        .order_by(models.FarmExpense.expense_date.desc())
        .all()
    )

    return [expense_to_dict(item) for item in records]


@router.post("/expenses")
def create_expense(
    data: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    expense = models.FarmExpense(
        crop_name=data.crop_name.strip(),
        category=data.category.strip(),
        amount=data.amount,
        expense_date=data.expense_date,
        description=data.description,
        owner_id=current_user.id
    )

    db.add(expense)
    db.commit()
    db.refresh(expense)

    return expense_to_dict(expense)


@router.put("/expenses/{expense_id}")
def update_expense(
    expense_id: int,
    data: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    expense = (
        db.query(models.FarmExpense)
        .filter(
            models.FarmExpense.id == expense_id,
            models.FarmExpense.owner_id == current_user.id
        )
        .first()
    )

    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    expense.crop_name = data.crop_name.strip()
    expense.category = data.category.strip()
    expense.amount = data.amount
    expense.expense_date = data.expense_date
    expense.description = data.description

    db.commit()
    db.refresh(expense)

    return expense_to_dict(expense)


@router.delete("/expenses/{expense_id}")
def delete_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    expense = (
        db.query(models.FarmExpense)
        .filter(
            models.FarmExpense.id == expense_id,
            models.FarmExpense.owner_id == current_user.id
        )
        .first()
    )

    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    db.delete(expense)
    db.commit()

    return {"message": "Expense deleted successfully"}


# -------------------------------
# INCOME MANAGEMENT
# -------------------------------

@router.get("/income")
def get_income(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    records = (
        db.query(models.FarmIncome)
        .filter(models.FarmIncome.owner_id == current_user.id)
        .order_by(models.FarmIncome.sale_date.desc())
        .all()
    )

    return [income_to_dict(item) for item in records]


@router.post("/income")
def create_income(
    data: IncomeCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    total_amount = data.quantity * data.selling_price

    income = models.FarmIncome(
        crop_name=data.crop_name.strip(),
        quantity=data.quantity,
        unit=data.unit.strip(),
        selling_price=data.selling_price,
        total_amount=total_amount,
        sale_date=data.sale_date,
        buyer_name=data.buyer_name,
        description=data.description,
        owner_id=current_user.id
    )

    db.add(income)
    db.commit()
    db.refresh(income)

    return income_to_dict(income)


@router.put("/income/{income_id}")
def update_income(
    income_id: int,
    data: IncomeCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    income = (
        db.query(models.FarmIncome)
        .filter(
            models.FarmIncome.id == income_id,
            models.FarmIncome.owner_id == current_user.id
        )
        .first()
    )

    if not income:
        raise HTTPException(status_code=404, detail="Income record not found")

    income.crop_name = data.crop_name.strip()
    income.quantity = data.quantity
    income.unit = data.unit.strip()
    income.selling_price = data.selling_price
    income.total_amount = data.quantity * data.selling_price
    income.sale_date = data.sale_date
    income.buyer_name = data.buyer_name
    income.description = data.description

    db.commit()
    db.refresh(income)

    return income_to_dict(income)


@router.delete("/income/{income_id}")
def delete_income(
    income_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    income = (
        db.query(models.FarmIncome)
        .filter(
            models.FarmIncome.id == income_id,
            models.FarmIncome.owner_id == current_user.id
        )
        .first()
    )

    if not income:
        raise HTTPException(status_code=404, detail="Income record not found")

    db.delete(income)
    db.commit()

    return {"message": "Income deleted successfully"}
