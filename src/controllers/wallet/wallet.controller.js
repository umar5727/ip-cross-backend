const WalletBalance = require('../../models/wallet/wallet_balance.model');

// Get wallet balance for authenticated customer
exports.getWalletBalance = async (req, res) => {
  try {
    const customer_id = req.customer.customer_id;

    // Find wallet balance for the customer
    const wallet = await WalletBalance.findOne({
      where: {
        customer_id: customer_id
      },
      attributes: ['wallet_id', 'balance', 'default_upi_id', 'date_added', 'date_modified']
    });

    // If no wallet found, return zero balance
    const balance = wallet ? parseFloat(wallet.balance) : 0.00;
    const default_upi_id = wallet ? wallet.default_upi_id : null;

    res.status(200).json({
      success: true,
      data: {
        customer_id: customer_id,
        balance: balance,
        default_upi_id: default_upi_id,
        wallet_exists: !!wallet,
        last_updated: wallet ? wallet.date_modified : null
      }
    });
  } catch (error) {
    console.error('Get wallet balance error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not retrieve wallet balance'
    });
  }
};
