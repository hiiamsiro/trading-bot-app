# Phase 45: Dynamic Position Sizing

## Goal
Support dynamic position sizing.

## Requirements
- Support:
  - fixed size
  - percentage of balance
  - risk-based sizing

## Backend
- Update position size calculation

## Frontend
- Dropdown:
  - fixed
  - percentage
- Input:
  - risk %

Logic:
- size = balance * risk%

## Definition of Done
- user can control risk dynamically
