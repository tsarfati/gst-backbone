# Dynamic Budgets with Hierarchical Cost Codes

## Overview

This system implements a three-level hierarchical cost code structure with automatic budget rollup:

```
Level 1: Dynamic Groups     (e.g., "1.0")          - Top-level categories
Level 2: Dynamic Parents    (e.g., "1.09")         - Work breakdown items with budgets
Level 3: Child Codes        (e.g., "1.09-labor")   - Category-specific cost tracking
```

## How It Works

### Automatic Hierarchy

When you create cost codes, the system automatically establishes parent-child relationships based on the code pattern:

- **Child Code** `1.09-labor` → automatically parents to → **Dynamic Parent** `1.09`
- **Dynamic Parent** `1.09` → automatically parents to → **Dynamic Group** `1.0`

### Cost Rollup Flow

1. **Invoices are coded to child codes** (e.g., `1.09-labor`, `1.09-material`, `1.09-equipment`)
2. **Costs automatically roll up** to the dynamic parent (`1.09`)
3. **Parent costs roll up** to the dynamic group (`1.0`)

### Budget Control

- **Dynamic Groups**: Track total spending across entire categories (all 1.x codes)
- **Dynamic Parents**: Set budgets for work items, monitor vs. actuals across all categories
- **Child Codes**: No individual budgets needed - actuals accumulate to parent

## Example Structure

### Labor Category (Group 1.0)

```
1.0 - Labor Group ($500,000 total budget)
├── 1.09 - General Labor ($200,000 budget)
│   ├── 1.09-labor - General Labor costs
│   ├── 1.09-material - Materials used by general labor
│   └── 1.09-equipment - Equipment used by general labor
└── 1.10 - Skilled Labor ($150,000 budget)
    ├── 1.10-labor - Skilled labor costs
    ├── 1.10-material - Materials used by skilled labor
    └── 1.10-equipment - Equipment used by skilled labor
```

### Materials Category (Group 2.0)

```
2.0 - Materials Group ($750,000 total budget)
├── 2.01 - Concrete & Masonry ($300,000 budget)
│   ├── 2.01-labor - Labor for concrete work
│   ├── 2.01-material - Concrete materials and supplies
│   └── 2.01-equipment - Equipment for concrete work
└── 2.05 - Lumber & Wood ($150,000 budget)
    ├── 2.05-labor - Labor for lumber work
    ├── 2.05-material - Lumber and wood materials
    └── 2.05-equipment - Equipment for lumber work
```

## Setup Process

### Step 1: Create Dynamic Groups (Optional)

Dynamic groups are optional but helpful for high-level tracking:

```sql
INSERT INTO cost_codes (code, description, type, is_dynamic_group, company_id)
VALUES 
  ('1.0', 'Labor Group', 'labor', true, 'your-company-id'),
  ('2.0', 'Materials Group', 'material', true, 'your-company-id');
```

### Step 2: Create Dynamic Parents

These will have budgets assigned:

```sql
INSERT INTO cost_codes (code, description, type, company_id, job_id)
VALUES 
  ('1.09', 'General Labor', 'labor', 'your-company-id', 'your-job-id'),
  ('1.10', 'Skilled Labor', 'labor', 'your-company-id', 'your-job-id');
```

### Step 3: Create Child Codes

The system will automatically link these to their parents:

```sql
INSERT INTO cost_codes (code, description, type, company_id, job_id)
VALUES 
  ('1.09-labor', 'General Labor - Labor', 'labor', 'your-company-id', 'your-job-id'),
  ('1.09-material', 'General Labor - Materials', 'material', 'your-company-id', 'your-job-id'),
  ('1.09-equipment', 'General Labor - Equipment', 'equipment', 'your-company-id', 'your-job-id');
```

### Step 4: Create Dynamic Budgets

Set budgets for the dynamic parent codes:

1. Navigate to the job's budget page
2. Click the "Dynamic Budgets" tab
3. Select a parent cost code (e.g., `1.09`)
4. Enter the budget amount (e.g., `$200,000`)
5. Click "Create Dynamic Budget"

## Using the System

### When Creating Invoices

1. Code invoices to the **most specific child code** available (e.g., `1.09-labor` for labor costs)
2. The system automatically updates:
   - Child code actual amount
   - Parent code (`1.09`) actual amount
   - Dynamic budget comparison

### Multi-Category Analysis

This structure allows you to answer questions like:
- "How much labor vs materials did we spend on general labor?"
- "What percentage of concrete costs were equipment?"
- "Which work items have the highest material-to-labor ratio?"

### Monitoring Budgets

The Dynamic Budget Manager shows:

- **Budget**: Original allocated amount for the work item
- **Actual**: Total costs from all child codes (labor + material + equipment)
- **Committed**: Purchase orders and subcontracts
- **Remaining**: Budget minus actuals and commitments
- **Over Budget Warning**: Red indicator when costs exceed budget

### Adding New Child Codes

1. Expand a dynamic budget group
2. Scroll to "Add Child Cost Code" section
3. Enter the new code (must follow pattern: parent-category)
4. Enter description
5. Click "Add Child Cost Code"

## Chart of Accounts Integration

Each cost code can be linked to your chart of accounts:

- **Groups**: Summary accounts (e.g., 5000, 6000, 7000)
- **Parents**: Department accounts (e.g., 5010, 5020, 6010)
- **Children**: Detailed accounts (e.g., 5011, 5012, 5013)

This enables:
- Financial statement reporting
- General ledger integration
- Multi-dimensional cost analysis

## Best Practices

### Code Naming

- **Groups**: Major category + .0 (1.0, 2.0, 3.0, 4.0, 5.0)
- **Parents**: Two-segment numbers (1.09, 1.10, 2.01, 2.05)
- **Children**: Parent code + dash + category (1.09-labor, 1.09-material, 1.09-equipment)

### Budget Allocation

1. Start with top-level group estimates
2. Break down into parent budgets by work item
3. Let child codes accumulate actual costs by category
4. Review and adjust parent budgets as needed

### Cost Tracking

- Always code to the most specific category available
- Use `-labor` suffix for labor costs
- Use `-material` suffix for material costs
- Use `-equipment` suffix for equipment costs
- Review parent-level reports for variance analysis
- Monitor groups for overall category performance

### Category Suffix Standards

Recommended suffixes for consistency:
- `-labor`: Direct labor costs
- `-material`: Materials and supplies
- `-equipment`: Equipment rental, operation, depreciation
- `-subcontractor`: Subcontractor costs
- `-other`: Miscellaneous costs

## Import from CSV

Use the provided `cost-codes-example.csv` file as a template:

1. Download the example CSV
2. Modify with your cost codes
3. Import in this order:
   - Dynamic groups first (codes ending in .0)
   - Parent codes second (two-segment codes)
   - Child codes last (codes with dash suffix)
4. The system will automatically establish relationships

## Reporting

### Available Views

- **Dynamic Budget Summary**: Real-time budget vs. actual by parent
- **Category Breakdown**: Labor vs materials vs equipment by work item
- **Cost Code Hierarchy**: Visual tree of relationships
- **Variance Report**: Over/under budget analysis by category
- **Trend Analysis**: Cost accumulation over time

### Key Metrics

- **Budget Utilization**: Actual ÷ Budget
- **Forecast at Completion**: Actual + Committed
- **Variance**: Budget - Forecast at Completion
- **% Complete**: Based on actual spending vs. budget
- **Category Mix**: Labor % vs Material % vs Equipment %

## Troubleshooting

### Parent Not Found

If a child code doesn't link to a parent:
1. Ensure the parent code exists (e.g., `1.09` for `1.09-labor`)
2. Verify the code follows the pattern (parent-category)
3. Check that company_id and job_id match

### Budget Not Rolling Up

If costs aren't accumulating to parent:
1. Verify the dynamic budget was created for the parent
2. Check that invoices are approved
3. Ensure child codes have correct parent_cost_code_id

### Missing Dynamic Group

If parent codes don't show a group:
1. Create the group cost code with `is_dynamic_group = true`
2. Ensure the group code ends in .0 (e.g., `1.0`, `2.0`)
3. Refresh the budget manager

## Support

For additional help:
- Review the example CSV file
- Check the cost code hierarchy in Cost Code Manager
- Contact your system administrator
