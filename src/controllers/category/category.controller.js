const { Category, Product, CategoryDescription } = require('../../models');
const { cache } = require('../../../config/redis');
const sequelize = require('../../../config/database');

// Get all categories with caching
exports.getAllCategories = [
  cache(300), // Cache for 5 minutes
  async (req, res) => {
    try {
      const languageId = parseInt(req.query.language_id) || 1;
      const limit = parseInt(req.query.limit) || 0;
      const withDescription = req.query.description === 'true';
      
      const queryOptions = {
        where: {
          status: true
        },
        include: [{
          model: sequelize.models.category_description,
          attributes: ['name', ...(withDescription ? ['description', 'meta_title'] : [])],
          where: { language_id: languageId },
          required: false
        }],
        order: [['sort_order', 'ASC']]
      };
      
      if (limit > 0) {
        queryOptions.limit = limit;
      }
      
      const categories = await Category.findAll(queryOptions);

      res.status(200).json({
        success: true,
        count: categories.length,
        data: categories
      });
    } catch (error) {
      console.error('Get all categories error:', error);
      res.status(500).json({
        success: false,
        message: 'Could not retrieve categories',
        error: error.message
      });
    }
  }
];

// Get category by ID with products
exports.getCategoryById = [
  cache(300), // Cache for 5 minutes
  async (req, res) => {
    try {
      const languageId = parseInt(req.query.language_id) || 1;
      
      const category = await Category.findByPk(req.params.id, {
        include: [{
          model: CategoryDescription,
          attributes: ['name', 'description'],
          where: { language_id: languageId },
          required: false
        }]
      });

      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }

      // Get products in this category
      const products = await Product.findAll({
        include: [{
          model: Category,
          where: { category_id: req.params.id },
          attributes: [],
          through: { attributes: [] }
        }],
        limit: 10
      });

      res.status(200).json({
        success: true,
        data: {
          category,
          products
        }
      });
    } catch (error) {
      console.error('Get category by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Could not retrieve category'
      });
    }
  }
];

// Create new category
exports.createCategory = async (req, res) => {
  try {
    const {
      image,
      parent_id,
      top,
      column,
      sort_order,
      status
    } = req.body;

    const category = await Category.create({
      image,
      parent_id: parent_id || 0,
      top: top || false,
      column: column || 1,
      sort_order: sort_order || 0,
      status: status !== undefined ? status : true,
      date_added: new Date(),
      date_modified: new Date()
    });

    res.status(201).json({
      success: true,
      data: category
    });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not create category'
    });
  }
};

// Update category
exports.updateCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;
    
    // Check if category exists
    const category = await Category.findByPk(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Update category
    const {
      image,
      parent_id,
      top,
      column,
      sort_order,
      status
    } = req.body;
    
    await category.update({
      image: image || category.image,
      parent_id: parent_id !== undefined ? parent_id : category.parent_id,
      top: top !== undefined ? top : category.top,
      column: column || category.column,
      sort_order: sort_order !== undefined ? sort_order : category.sort_order,
      status: status !== undefined ? status : category.status,
      date_modified: new Date()
    });

    res.status(200).json({
      success: true,
      data: category
    });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not update category'
    });
  }
};

// Delete category
exports.deleteCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;
    
    // Check if category exists
    const category = await Category.findByPk(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Check if category has products
    const productsCount = await Product.count({
      where: { category_id: categoryId }
    });

    if (productsCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category with ${productsCount} products. Move or delete products first.`
      });
    }

    // Delete category
    await category.destroy();

    res.status(200).json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not delete category'
    });
  }
};