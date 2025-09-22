const { Customer } = require('../../models');
const { cache } = require('../../../config/redis');

// Get all customers with pagination
exports.getAllCustomers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const customers = await Customer.findAndCountAll({
      attributes: { exclude: ['password', 'salt'] },
      limit,
      offset,
      order: [['date_added', 'DESC']]
    });

    res.status(200).json({
      success: true,
      count: customers.count,
      data: customers.rows,
      totalPages: Math.ceil(customers.count / limit),
      currentPage: page
    });
  } catch (error) {
    console.error('Get all customers error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not retrieve customers'
    });
  }
};

// Get customer by ID
exports.getCustomerById = async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.params.id, {
      attributes: { exclude: ['password', 'salt'] }
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    res.status(200).json({
      success: true,
      data: customer
    });
  } catch (error) {
    console.error('Get customer by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not retrieve customer'
    });
  }
};

// Update customer
exports.updateCustomer = async (req, res) => {
  try {
    const customerId = req.params.id;
    
    // Check if customer exists
    const customer = await Customer.findByPk(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Update customer
    const { firstname, lastname, email, telephone } = req.body;
    
    await customer.update({
      firstname: firstname || customer.firstname,
      lastname: lastname || customer.lastname,
      email: email || customer.email,
      telephone: telephone || customer.telephone
    });

    // Get updated customer without password
    const updatedCustomer = await Customer.findByPk(customerId, {
      attributes: { exclude: ['password', 'salt'] }
    });

    res.status(200).json({
      success: true,
      data: updatedCustomer
    });
  } catch (error) {
    console.error('Update customer error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not update customer'
    });
  }
};

// Delete customer
exports.deleteCustomer = async (req, res) => {
  try {
    const customerId = req.params.id;
    
    // Check if customer exists
    const customer = await Customer.findByPk(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Delete customer
    await customer.destroy();

    res.status(200).json({
      success: true,
      message: 'Customer deleted successfully'
    });
  } catch (error) {
    console.error('Delete customer error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not delete customer'
    });
  }
};