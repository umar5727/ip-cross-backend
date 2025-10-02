# Product Availability Check Fix

## Problem

1. **Confusing Error Message**: Error said "Status: 1" when status=1 means product is active
2. **Too Strict Stock Check**: Products with negative stock (-1) were blocked even if they allow back-orders
3. **No Respect for `subtract` Flag**: Inventory tracking setting was ignored

### Error Example:
```
Product "ABC" is not available (Status: 1, Stock: -1)
```
This is confusing because:
- Status 1 = Active/Available ✅
- Stock -1 = Could be allowed if back-orders enabled

## Solution Implemented

### 1. **Improved Availability Check** ✅

**File:** `src/controllers/checkout/checkout_confirm.controller.js`

**Before (Broken):**
```javascript
if (!item.product_data.status || item.product_data.quantity < 1) {
  throw new Error(`Product ${name} is not available (Status: ${status}, Stock: ${qty}).`);
}
```
- ❌ Single confusing error message
- ❌ Blocks all products with stock < 1
- ❌ Doesn't consider `subtract` flag

**After (Fixed):**
```javascript
// Check 1: Product must be active (status = true/1)
if (!item.product_data.status) {
  throw new Error(`Product "${name}" is currently inactive and cannot be purchased.`);
}

// Check 2: If inventory tracking is enabled (subtract = true), check stock availability
if (item.product_data.subtract && item.product_data.quantity < item.quantity) {
  throw new Error(`Product "${name}" has insufficient stock. Available: ${stock}, Requested: ${qty}.`);
}
```
- ✅ Two separate checks with specific error messages
- ✅ Only checks stock if `subtract = true`
- ✅ Compares available stock with requested quantity
- ✅ Allows back-orders if `subtract = false`

### 2. **Updated Stock Deduction Logic** ✅

**File:** `src/models/checkout/order.model.js`

**Before (Always Subtracted):**
```javascript
async updateProductStock(transaction, products) {
  for (const product of products) {
    await sequelize.query(
      'UPDATE oc_product SET quantity = quantity - :quantity WHERE product_id = :productId',
      { ... }
    );
  }
}
```
- ❌ Always subtracts stock
- ❌ Doesn't check `subtract` flag

**After (Respects subtract Flag):**
```javascript
async updateProductStock(transaction, products) {
  for (const product of products) {
    const shouldSubtract = product.product_data?.subtract !== false;
    
    if (shouldSubtract) {
      await sequelize.query(
        'UPDATE oc_product SET quantity = quantity - :quantity 
         WHERE product_id = :productId AND subtract = 1',
        { ... }
      );
      console.log(`Stock updated for product ${id}: -${qty}`);
    } else {
      console.log(`Stock NOT updated for product ${id} (subtract disabled)`);
    }
  }
}
```
- ✅ Only subtracts if `subtract = true`
- ✅ Adds WHERE clause for safety
- ✅ Logs what happened for debugging

## How It Works Now

### Product Status Values:

| Field | Value | Meaning | Order Allowed? |
|-------|-------|---------|----------------|
| `status` | `0` or `false` | Inactive/Hidden | ❌ Blocked |
| `status` | `1` or `true` | Active/Visible | ✅ Continue to stock check |
| `subtract` | `0` or `false` | No inventory tracking | ✅ Always allowed |
| `subtract` | `1` or `true` | Track inventory | ✅ Only if stock available |

### Example Scenarios:

#### Scenario 1: Active Product with Stock Tracking
```
status = 1, subtract = 1, quantity = 10
Cart quantity = 5
Result: ✅ Order allowed, stock becomes 5
```

#### Scenario 2: Active Product with Negative Stock & Back-orders
```
status = 1, subtract = 0, quantity = -1
Cart quantity = 5
Result: ✅ Order allowed, stock stays -1 (no tracking)
```

#### Scenario 3: Active Product with Insufficient Stock
```
status = 1, subtract = 1, quantity = 3
Cart quantity = 5
Result: ❌ Blocked with error:
"Product X has insufficient stock. Available: 3, Requested: 5."
```

#### Scenario 4: Inactive Product
```
status = 0, subtract = 1, quantity = 100
Cart quantity = 1
Result: ❌ Blocked with error:
"Product X is currently inactive and cannot be purchased."
```

## Error Messages

### Old (Confusing):
```
Product ABC is not available (Status: 1, Stock: -1).
```
- ❓ Why is it not available if status is 1?
- ❓ Is -1 stock always bad?

### New (Clear):

**Inactive Product:**
```
Product "ABC" is currently inactive and cannot be purchased.
```
- ✅ Clear reason: Product is inactive

**Insufficient Stock:**
```
Product "ABC" has insufficient stock. Available: 3, Requested: 5.
```
- ✅ Clear reason: Not enough stock
- ✅ Shows what's available vs requested

## Console Logs

### Availability Check:
```
Product 23204 availability check: {
  name: 'Cotton Tee Shirt',
  status: 1,
  stock_quantity: -1,
  subtract: 0,
  cart_quantity: 1
}
```

### Stock Update:
```
Stock NOT updated for product 23204 (subtract disabled)
```
or
```
Stock updated for product 23205: -2
```

## Benefits

1. ✅ **Clear Error Messages**: Users know exactly why order failed
2. ✅ **Back-order Support**: Products with `subtract=0` can be ordered with negative stock
3. ✅ **Inventory Control**: Products with `subtract=1` enforce stock limits
4. ✅ **Accurate Stock**: Only tracked products get stock deducted
5. ✅ **Better Debugging**: Console logs show what's happening

## Testing

To test the fix:

1. **Test with tracking disabled (subtract=0):**
   ```sql
   UPDATE oc_product SET subtract = 0, quantity = -1 WHERE product_id = 123;
   ```
   Should allow order even with -1 stock ✅

2. **Test with tracking enabled (subtract=1):**
   ```sql
   UPDATE oc_product SET subtract = 1, quantity = 3 WHERE product_id = 123;
   ```
   Cart with 5 quantity should fail with clear message ❌

3. **Test inactive product:**
   ```sql
   UPDATE oc_product SET status = 0 WHERE product_id = 123;
   ```
   Should block with "inactive" message ❌

