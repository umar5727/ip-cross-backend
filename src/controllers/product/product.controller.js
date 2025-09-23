const { Product, Category, CategoryDescription, ProductSpecial, ProductDescription, ProductImage, ProductVariant } = require('../../models');
const { cache } = require('../../../config/redis');
const { Op } = require('sequelize');

// Get all products with pagination and caching
exports.getAllProducts = [
  cache(300), // Cache for 5 minutes
  async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;
      const categoryId = req.query.category_id;
      const searchQuery = req.query.search;
      const languageId = parseInt(req.query.language_id) || 1;
      
      // Build query options
      const queryOptions = {
        limit,
        offset,
        order: [['date_added', 'DESC']],
        include: [
          {
            model: Category,
            attributes: ['category_id', 'parent_id'],
            include: [{
              model: CategoryDescription,
              attributes: ['name'],
              where: { language_id: languageId },
              required: false
            }],
            required: false
          },
          {
            model: ProductSpecial,
            attributes: ['price', 'date_start', 'date_end'],
            required: false,
            where: {
              [Op.and]: [
                {
                  [Op.or]: [
                    { date_start: '0000-00-00' },
                    { date_start: { [Op.lte]: new Date() } }
                  ]
                },
                {
                  [Op.or]: [
                    { date_end: '0000-00-00' },
                    { date_end: { [Op.gte]: new Date() } }
                  ]
                }
              ]
            }
          },
          {
            model: ProductDescription,
            attributes: ['name', 'meta_title', 'meta_description', 'meta_keyword', 'tag'],
            where: { language_id: languageId },
            required: false
          },
          {
            model: ProductImage,
            attributes: ['image', 'sort_order'],
            required: false
          }
        ],
        distinct: true
      };
      
      // Add category filter if provided
      if (categoryId) {
        queryOptions.include[0].where = { category_id: categoryId };
      }

      // Add search filter if provided
      if (searchQuery) {
        queryOptions.include.find(inc => inc.model === ProductDescription).where = {
          ...queryOptions.include.find(inc => inc.model === ProductDescription).where,
          [Op.or]: [
            { name: { [Op.like]: `%${searchQuery}%` } },
            { description: { [Op.like]: `%${searchQuery}%` } },
            { tag: { [Op.like]: `%${searchQuery}%` } }
          ]
        };
      }

      const products = await Product.findAndCountAll(queryOptions);

      // Format the response data to include special price (selling price) and MRP
      const formattedProducts = products.rows.map(product => {
        const productJson = product.toJSON();
        const specialPrice = product.product_specials && product.product_specials.length > 0 
          ? product.product_specials[0].price 
          : null;
        
        return {
          ...productJson,
          mrp: productJson.price, // Original price is MRP
          selling_price: specialPrice, // Special price is selling price
          name: product.product_descriptions && product.product_descriptions.length > 0 
            ? product.product_descriptions[0].name 
            : null,
          description: product.product_descriptions && product.product_descriptions.length > 0 
            ? product.product_descriptions[0].description 
            : null,
          images: product.product_images || []
        };
      });

      res.status(200).json({
        success: true,
        count: products.count,
        data: formattedProducts,
        totalPages: Math.ceil(products.count / limit),
        currentPage: page
      });
    } catch (error) {
      console.error('Get all products error:', error);
      res.status(500).json({
        success: false,
        message: 'Could not retrieve products',
        error: error.message
      });
    }
  }
];

// Get product by ID with caching
exports.getProductById = [
  cache(300), // Cache for 5 minutes
  async (req, res) => {
    try {
      const languageId = parseInt(req.query.language_id) || 1;
      
      const product = await Product.findByPk(req.params.id, {
        include: [
          {
            model: Category,
            attributes: ['category_id', 'parent_id']
          },
          {
            model: ProductSpecial,
            attributes: ['price', 'date_start', 'date_end'],
            required: false,
            where: {
              [Op.and]: [
                {
                  [Op.or]: [
                    { date_start: '0000-00-00' },
                    { date_start: { [Op.lte]: new Date() } }
                  ]
                },
                {
                  [Op.or]: [
                    { date_end: '0000-00-00' },
                    { date_end: { [Op.gte]: new Date() } }
                  ]
                }
              ]
            }
          },
          {
            model: ProductDescription,
            attributes: ['name', 'description', 'meta_title', 'meta_description', 'meta_keyword', 'tag'],
            where: { language_id: languageId },
            required: false
          },
          {
            model: ProductImage,
            attributes: ['image', 'sort_order'],
            required: false
          },
          {
            model: ProductVariant,
            attributes: ['variant_group_id', 'variant_name', 'variant_image'],
            required: false
          }
        ]
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      // Increment view count
      await product.update({
        viewed: product.viewed + 1
      });

      // Format the response data
      const productJson = product.toJSON();
      const specialPrice = product.product_specials && product.product_specials.length > 0 
        ? product.product_specials[0].price 
        : null;
      
      const formattedProduct = {
        ...productJson,
        mrp: productJson.price, // Original price is MRP
        selling_price: specialPrice, // Special price is selling price
        name: product.product_descriptions && product.product_descriptions.length > 0 
          ? product.product_descriptions[0].name 
          : null,
        description: product.product_descriptions && product.product_descriptions.length > 0 
          ? product.product_descriptions[0].description 
          : null,
        images: product.product_images || []
      };

      res.status(200).json({
        success: true,
        data: formattedProduct
      });
    } catch (error) {
      console.error('Get product by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Could not retrieve product',
        error: error.message
      });
    }
  }
];

// Create new product
exports.createProduct = async (req, res) => {
  try {
    const {
      model,
      sku,
      quantity,
      stock_status_id,
      image,
      manufacturer_id,
      price,
      category_id,
      status
    } = req.body;

    const product = await Product.create({
      model,
      sku,
      quantity: quantity || 0,
      stock_status_id: stock_status_id || 1,
      image,
      manufacturer_id,
      price: price || 0,
      category_id,
      status: status !== undefined ? status : true,
      date_added: new Date(),
      date_modified: new Date()
    });

    res.status(201).json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not create product'
    });
  }
};

// Update product
exports.updateProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    
    // Check if product exists
    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Update product
    const {
      model,
      sku,
      quantity,
      stock_status_id,
      image,
      manufacturer_id,
      price,
      category_id,
      status
    } = req.body;
    
    await product.update({
      model: model || product.model,
      sku: sku || product.sku,
      quantity: quantity !== undefined ? quantity : product.quantity,
      stock_status_id: stock_status_id || product.stock_status_id,
      image: image || product.image,
      manufacturer_id: manufacturer_id || product.manufacturer_id,
      price: price !== undefined ? price : product.price,
      category_id: category_id || product.category_id,
      status: status !== undefined ? status : product.status,
      date_modified: new Date()
    });

    // Get updated product
    const updatedProduct = await Product.findByPk(productId, {
      include: [
        {
          model: Category,
          attributes: ['category_id', 'parent_id']
        }
      ]
    });

    res.status(200).json({
      success: true,
      data: updatedProduct
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not update product'
    });
  }
};

// Delete product
exports.deleteProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    
    // Check if product exists
    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Delete product
    await product.destroy();

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not delete product'
    });
  }
};