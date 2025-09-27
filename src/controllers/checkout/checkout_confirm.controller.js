/**
 * Checkout Confirmation Controller
 * Handles the checkout confirmation process
 */

const db = require('../../../config/database');
// Create a connection variable that references db.connection for backward compatibility
const connection = db.connection;
// Debug log to check connection object
console.log('checkout_confirm.controller.js - connection object type:', typeof connection);
console.log('checkout_confirm.controller.js - connection has query method:', typeof connection.query === 'function');
const orderModel = require('../../models/checkout/order.model');
const Address = require('../../models/customer/address.model');
const Cart = require('../../models/cart/cart.model');
const VoucherModel = require('../../models/discount/voucher.model');
const CouponModel = require('../../models/discount/coupon.model');
const AffiliateModel = require('../../models/affiliate/affiliate.model');
const ReferralModel = require('../../models/marketing/referral.model');
// Replace above with your actual models if different

exports.confirmCheckout = async (req, res) => {
  console.log('Starting confirmCheckout');
  const transaction = await db.transaction();
  try {
    console.log('Transaction started');
    const customer_id = req.user.customer_id;

    // 1. Validate input
    const { payment_method, comment, agree_terms, address_id, shipping_address_id, alternate_mobile_number, 'gst-no': gstNo, referral_code, voucher_code, coupon_code } = req.body;
    if (!payment_method || !agree_terms) throw new Error("Payment method and agreement to terms are required");
    if (!agree_terms) throw new Error("You must agree to the terms and conditions");

    // 2. Resolve shipping address
    const addressIdToUse = shipping_address_id || address_id;
    if (!addressIdToUse) throw new Error('No shipping address provided');
    const shipping_address = await Address.getAddress(addressIdToUse, customer_id);
    if (!shipping_address) throw new Error('Shipping address not found');

    // 3. Resolve payment address (default or shipping)
    let payment_address = await Address.getDefaultAddress(customer_id);
    if (!payment_address) payment_address = shipping_address;

    // 4. Get cart items, with all product info/joins
    const cartItems = await Cart.getCartWithDetails(customer_id); // Should join/return {product_data, quantity, etc}
    if (!cartItems || cartItems.length === 0) throw new Error('Cart is empty');

    // 5. Minimum qty check: aggregate total quantity for each product
    const minQtyMap = {};
    cartItems.forEach(item => {
      minQtyMap[item.product_id] = (minQtyMap[item.product_id] || 0) + item.quantity;
    });
    for (let item of cartItems) {
      if (minQtyMap[item.product_id] < item.product_data.minimum) {
        throw new Error(`Minimum quantity for ${item.product_data.name} is ${item.product_data.minimum} (current: ${minQtyMap[item.product_id]})`);
      }
      
      // Check product availability: status must be 1 and quantity must be at least 1
      if (item.product_data.status !== 1 || item.product_data.quantity < 1) {
        throw new Error(`Product ${item.product_data.name} is not available.`);
      }
    }

    // 6. Per-product business logic and order creation
    let orderIds = [];
    
    // We'll create the parent order AFTER collecting all order IDs

    // Advanced per-line logic
    // First purchase discount only once per customer
    const firstPurchaseDiscountPct = await orderModel.getFirstTimeDiscountPct(customer_id);
    const isFirstPurchase = !!(firstPurchaseDiscountPct);

    // Low-order fee only for first product if subtotal below threshold
    const lowOrderFeeThreshold = 500, lowOrderFeeAmount = 80;
    let grandTotal = 0, grandCourierCharges = 0;
    let totalSubtotal = cartItems.reduce((sum, item) => sum + item.product_data.price * item.quantity, 0);
    let lowOrderFeeApplied = false;

    // Gather any vouchers/coupons
    const voucher = voucher_code ? await VoucherModel.getVoucher(voucher_code) : null;
    const coupon = coupon_code ? await CouponModel.getCoupon(coupon_code) : null;

    // Calculate affiliate/referral/marketing info
    const affiliate = referral_code ? await AffiliateModel.getAffiliate(referral_code) : null;
    const referral = referral_code ? await ReferralModel.getReferral(referral_code) : null;

    let firstProduct = true;
    for (let cartItem of cartItems) {
      // Base pricing calculation
      let baseTotal = cartItem.product_data.price * cartItem.quantity;

      // Downloadable/recurring data handling (add relevant data if needed)
      let recurringInfo = cartItem.product_data.recurring ? cartItem.product_data.recurring : null;
      let downloadInfo = cartItem.product_data.download ? cartItem.product_data.download : null;

      // Courier charge calc - commented out old implementation
      /*
      let courierCharge = 0;
      if (cartItem.product_data.shipping === 1) {
        const courierRes = await orderModel.getCourierCharge(cartItem.product_id, shipping_address.postcode);
        if (courierRes.type === 'local') courierCharge = 50;
        else if (courierRes.type === 'zonal') courierCharge = 80;
        else if (courierRes.type === 'national') courierCharge = 120;
      }
      */
      
      // New courier charge logic - apply only to first order if shipping=1 and total<500
      let courierCharge = 0;
      if (firstProduct && cartItem.product_data.shipping === 1 && totalSubtotal < 500) {
        const courierRes = await orderModel.getCourierCharge(cartItem.product_id, shipping_address.postcode);
        if (courierRes.type === 'local') courierCharge = 50;
        else if (courierRes.type === 'zonal') courierCharge = 80;
        else if (courierRes.type === 'national') courierCharge = 120;
      }
      // Apply only once if below threshold
      if (firstProduct && totalSubtotal < lowOrderFeeThreshold && !lowOrderFeeApplied) {
        baseTotal += lowOrderFeeAmount;
        lowOrderFeeApplied = true;
      }

      // Voucher/coupon proportional split
      let voucherDiscount = voucher ? (baseTotal / totalSubtotal) * voucher.amount : 0;
      let couponDiscount = coupon ? (baseTotal / totalSubtotal) * coupon.amount : 0;

      // First purchase discount
      let firstPurDiscount = (isFirstPurchase && firstPurchaseDiscountPct) ? baseTotal * (firstPurchaseDiscountPct / 100) : 0;

      // Calculate final total
      let finalTotal = baseTotal + courierCharge - voucherDiscount - couponDiscount - firstPurDiscount;
      grandTotal += finalTotal; grandCourierCharges += courierCharge;

      // Prepare product order data
      let orderData = {
        customer_id,
        firstname: req.customer.firstname, lastname: req.customer.lastname,
        email: req.customer.email, telephone: req.customer.telephone || '',
        customer_group_id: req.customer.customer_group_id,
        language_id: req.customer.language_id || 1,
        currency_id: 4,
        currency_code: 'INR',
        store_name: 'ipshopy',
        store_url: 'https://www.ipshopy.com/',
        date_added: new Date(),
        date_modified: new Date(),
        total_courier_charges: firstProduct ? courierCharge : 0,
        payment_firstname: payment_address.firstname, payment_lastname: payment_address.lastname,
        payment_address_1: payment_address.address_1, payment_address_2: payment_address.address_2 || '',
        payment_city: payment_address.city, payment_postcode: payment_address.postcode,
        payment_country: payment_address.country, payment_country_id: payment_address.country_id,
        payment_zone: payment_address.zone, payment_zone_id: payment_address.zone_id,
        payment_telephone: payment_address.mobile_number || req.user.telephone || '',
        shipping_firstname: shipping_address.firstname, shipping_lastname: shipping_address.lastname,
        shipping_address_1: shipping_address.address_1, shipping_address_2: shipping_address.address_2 || '',
        shipping_city: shipping_address.city, shipping_postcode: shipping_address.postcode,
        shipping_country: shipping_address.country, shipping_country_id: shipping_address.country_id,
        shipping_zone: shipping_address.zone, shipping_zone_id: shipping_address.zone_id,
        shipping_telephone: shipping_address.mobile_number || req.user.telephone || '',
        payment_method: payment_method.title || '', payment_code: payment_method.code || '',
        shipping_method: req.body.shipping_method?.title || '', shipping_code: req.body.shipping_method?.code || '',
        comment: comment || '',
        total: finalTotal,
        recurring: recurringInfo,
        download: downloadInfo,
        voucherDiscount, couponDiscount, firstPurDiscount, courierCharge,
        ip: req.ip, user_agent: req.headers['user-agent'],
        order_status_id: payment_method.code === 'cod' ? 2 : 0,
        alternate_mobile_number: alternate_mobile_number || null,
        gst_no: gstNo || null,
        referral_code: referral_code || '',
        affiliate_id: affiliate?.id || null,
        marketing_id: referral?.id || null
      };

      // Insert order and details
      const orderId = await orderModel.addOrder(transaction, orderData);
      orderIds.push(orderId);

      // Add order products/downloads/recurring
      await orderModel.addOrderProducts(transaction, orderId, [cartItem]);
      if (recurringInfo) await orderModel.addOrderRecurring(transaction, orderId, recurringInfo);
      if (downloadInfo) await orderModel.addOrderDownload(transaction, orderId, downloadInfo);

      // Add voucher/coupon and commission as needed
      if (voucher) await orderModel.addOrderVoucher(transaction, orderId, voucher.code, voucherDiscount);
      if (coupon) await orderModel.addOrderCoupon(transaction, orderId, coupon.code, couponDiscount);

      // Add totals (could break out to model function)
      await orderModel.addOrderTotals(transaction, orderId, finalTotal, courierCharge, voucherDiscount, couponDiscount, firstPurDiscount);

      // Update stock
      await orderModel.updateProductStock(transaction, [cartItem]);

      if (firstProduct) firstProduct = false;
    }

    // (Optional) Session/redis passing for frontend continuity (mock example)
    // req.session.order_ids = orderIds; // Use express-session or Redis as needed

    // Process payment (if needed)
    let paymentResult = await orderModel.processPayment(transaction, payment_method, orderIds, req.body);

    // Error if payment failed
    if (!paymentResult.success) { throw new Error(paymentResult.message); }

    // Create parent order with order IDs and totals
    if (orderIds.length > 0) {
      // Convert orderIds to JSON string like in the PHP code
      const orderIdsJson = JSON.stringify(orderIds.map(id => parseInt(id)));
      
      // Create parent order data object
      const parentData = {
        order_ids: orderIdsJson,
        courier_charges: grandCourierCharges,
        total: grandTotal
      };
      
      // Create parent order
      let parentOrderId = await orderModel.createParentOrder(transaction, parentData);
      
      // Store in session
      // req.session.parent_order_id = parentOrderId;
      // req.session.order_id = orderIds;
    }

    // Clear cart and complete
    await Cart.clearCart(customer_id);

    console.log('order created- parent_order_id is = ' );
    await transaction.commit();
    console.log('transaction commited' );
    // Success response; all business rules included
    return res.status(200).json({
      success: true,
      order_success: payment_method.code === 'cod',
      message: payment_method.code === 'cod' ? 'Order placed successfully' : 'Payment process initiated',
      order_ids: orderIds,
      // parent_order_id: parentOrderId,
      payment_info: paymentResult.data,
      // grand_total: grandTotal,
      // courier_charges: grandCourierCharges,
      // session: req.session || {}
    });

  } catch (error) {
    await transaction.rollback();
    return res.status(500).json({ success: false, message: error.message || 'An error occurred during checkout' });
  }
};
