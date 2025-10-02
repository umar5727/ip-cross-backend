const { Product, Category, CategoryDescription, ProductSpecial, ProductDescription, ProductImage, ProductVariant } = require('../../models');
const { cache } = require('../../../config/redis');
const { Op, Sequelize } = require('sequelize');
const sanitizeHtml = require('sanitize-html');
const { resizeImage } = require('../../utils/image');

// HTML sanitization configuration
const sanitizeOptions = {
  allowedTags: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'p', 'a', 'ul', 'ol', 
    'nl', 'li', 'b', 'i', 'strong', 'em', 'strike', 'code', 'hr', 'br', 'div', 
    'table', 'thead', 'caption', 'tbody', 'tr', 'th', 'td', 'pre', 'span', 'font'],
  allowedAttributes: {
    a: ['href', 'name', 'target'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    div: ['style', 'class'],
    span: ['style', 'class'],
    font: ['style', 'face', 'color', 'size'],
    p: ['style'],
    table: ['style', 'class', 'border', 'cellpadding', 'cellspacing'],
    '*': ['style', 'class']
  },
  selfClosing: ['img', 'br', 'hr', 'input'],
  allowedStyles: {
    '*': {
      'color': [/.*/],
      'text-align': [/.*/],
      'font-size': [/.*/],
      'margin': [/.*/],
      'padding': [/.*/],
      'font-family': [/.*/]
    }
  }
};

// Product additional information utility functions
const getProductSizeChart = async (productId) => {
  try {
    // In a real implementation, this would query the database
    // For now, we'll return sample data based on product ID
    return {
      title: "Size Chart",
      content: `<table class="size-chart">
        <thead>
          <tr>
            <th>Size</th>
            <th>Chest (in)</th>
            <th>Waist (in)</th>
            <th>Hips (in)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>S</td>
            <td>36-38</td>
            <td>28-30</td>
            <td>35-37</td>
          </tr>
          <tr>
            <td>M</td>
            <td>39-41</td>
            <td>31-33</td>
            <td>38-40</td>
          </tr>
          <tr>
            <td>L</td>
            <td>42-44</td>
            <td>34-36</td>
            <td>41-43</td>
          </tr>
          <tr>
            <td>XL</td>
            <td>45-47</td>
            <td>37-39</td>
            <td>44-46</td>
          </tr>
        </tbody>
      </table>`
    };
  } catch (error) {
    console.error('Error fetching product size chart:', error);
    return null;
  }
};







const getProductWarranty = async (productId) => {
  try {
    // In a real implementation, this would query the database
    return {
      title: "Warranty Information",
      content: `<div class="warranty-info">
        <p>This product comes with a 1-year manufacturer warranty covering defects in materials and workmanship.</p>
        <p>The warranty does not cover damage from misuse, accidents, or normal wear and tear.</p>
        <p>To claim warranty, please contact our customer service with your order number and a description of the issue.</p>
      </div>`
    };
  } catch (error) {
    console.error('Error fetching product warranty:', error);
    return null;
  }
};

const getProductReturnPolicy = async (productId) => {
  try {
    // In a real implementation, this would query the database
    return {
      title: "Return Policy",
      content: `<div class="return-policy">
        <p>We accept returns within 30 days of delivery for unused items in original packaging.</p>
        <p>To initiate a return, please contact our customer service team with your order number.</p>
        <p>Refunds will be processed within 7-10 business days after we receive the returned item.</p>
        <p>Please note that shipping costs for returns are the responsibility of the customer unless the item is defective.</p>
      </div>`
    };
  } catch (error) {
    console.error('Error fetching product return policy:', error);
    return null;
  }
};

const getProductFAQs = async (productId) => {
  try {
    // In a real implementation, this would query the database
    return {
      title: "Frequently Asked Questions",
      items: [
        {
          question: "How do I choose the right size?",
          answer: "Please refer to our size chart for detailed measurements. If you're between sizes, we recommend sizing up for a more comfortable fit."
        },
        {
          question: "Is this product machine washable?",
          answer: "Yes, this product is machine washable. We recommend washing in cold water and tumble drying on low heat to maintain the quality and fit."
        },
        {
          question: "Does this product shrink after washing?",
          answer: "Our products are pre-shrunk, but we recommend following the care instructions to minimize any potential shrinkage."
        },
        {
          question: "How long does shipping take?",
          answer: "Standard shipping typically takes 3-5 business days. Express shipping options are available at checkout."
        }
      ]
    };
  } catch (error) {
    console.error('Error fetching product FAQs:', error);
    return null;
  }
};

// Function to sanitize and decode HTML content
const sanitizeDescription = (htmlContent) => {
  if (!htmlContent) return null;
  
  // First decode HTML entities
  let decodedHtml = htmlContent
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
  
  // Replace newline sequences with proper HTML line breaks
  decodedHtml = decodedHtml.replace(/\\r\\n|\\r|\\n/g, '<br>');
  decodedHtml = decodedHtml.replace(/\r\n|\r|\n/g, '<br>');
  
  // Then sanitize the HTML
  return sanitizeHtml(decodedHtml, sanitizeOptions);
};

// Get all products with pagination and caching
exports.getAllProducts = [
  cache(3600), // Cache for 1 hour
  async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10; // Default limit set to 10
      const offset = (page - 1) * limit;
      const categoryId = req.query.category_id;
      const searchQuery = req.query.search;
      const languageId = parseInt(req.query.language_id) || 1;
      
      // Additional filters
      const priceMin = parseFloat(req.query.price_min) || 0;
      const priceMax = parseFloat(req.query.price_max) || Number.MAX_SAFE_INTEGER;
      const manufacturerId = parseInt(req.query.manufacturer_id);
      const stockStatus = req.query.stock_status;
      const sortBy = req.query.sort_by || 'date_added';
      const sortOrder = req.query.sort_order || 'DESC';
      
      // Build query options
      const queryOptions = {
        limit,
        offset,
        where: {},
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
            as: 'product_description',
            attributes: ['name', 'meta_title', 'meta_description', 'meta_keyword', 'tag'],
            where: { language_id: languageId },
            required: false
          },
          {
            model: ProductImage,
            as: 'ProductImages',
            attributes: ['image', 'sort_order'],
            required: false
          }
        ],
        distinct: true
      };
      
      // Add price range filter
      queryOptions.where.price = {
        [Op.between]: [priceMin, priceMax]
      };
      
      // Custom sorting logic based on sortBy parameter
      if (sortBy === 'price') {
        // For price sorting, consider both regular price and special price (selling_price)
        queryOptions.order = [
          [Sequelize.literal(`
            CASE 
              WHEN (SELECT MIN(ps.price) FROM oc_product_special ps 
                    WHERE ps.product_id = product.product_id 
                    AND (ps.date_start = '0000-00-00' OR ps.date_start <= CURDATE())
                    AND (ps.date_end = '0000-00-00' OR ps.date_end >= CURDATE())
                    LIMIT 1) IS NOT NULL 
              THEN (SELECT MIN(ps.price) FROM oc_product_special ps 
                    WHERE ps.product_id = product.product_id 
                    AND (ps.date_start = '0000-00-00' OR ps.date_start <= CURDATE())
                    AND (ps.date_end = '0000-00-00' OR ps.date_end >= CURDATE())
                    LIMIT 1)
              ELSE product.price
            END
          `), sortOrder]
        ];
      } else {
        // For other fields, use standard sorting
        queryOptions.order = [[sortBy, sortOrder]];
      }
      
      // Add manufacturer filter if provided
      if (manufacturerId) {
        queryOptions.where.manufacturer_id = manufacturerId;
      }
      
      // Add stock status filter if provided
      // if (stockStatus) {
      //   queryOptions.where.stock_status_id = stockStatus;
      // }
          queryOptions.where.status = 1;
      // Add category filter if provided
      if (categoryId) {
        queryOptions.include[0].where = { category_id: categoryId };
      }

      // Add search filter if provided
      if (searchQuery) {
        // Find the ProductDescription include
        const productDescriptionInclude = queryOptions.include.find(inc => inc.model === ProductDescription);
        
        // Ensure we're using the correct alias for ProductDescription
        const correctInclude = productDescriptionInclude || queryOptions.include.find(inc => inc.as === 'product_description');
        
        if (correctInclude) {
          // Use full wildcard search for more comprehensive results
          const searchTerm = searchQuery.trim();
          const fullMatch = `%${searchTerm}%`;
          
          correctInclude.where = {
            ...correctInclude.where || {},
            [Op.or]: [
              { name: { [Op.like]: fullMatch } },
              { meta_title: { [Op.like]: fullMatch } },
              { tag: { [Op.like]: fullMatch } },
              { meta_keyword: { [Op.like]: fullMatch } },
              { meta_description: { [Op.like]: fullMatch } }
            ]
          };
          
          // Make sure the include is required to filter out products without matching descriptions
          correctInclude.required = true;
        }
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
          image: productJson.image ? resizeImage(productJson.image, 200, 200, true) : null,
          mrp: productJson.price, // Original price is MRP
          selling_price: specialPrice, // Special price is selling price
          name: product.product_description && product.product_description.length > 0 
            ? product.product_description[0].name 
            : null,
          description: product.product_description && product.product_description.length > 0 
            ? product.product_description[0].description 
            : null
          // Removed additional images array to optimize response size
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

// Load more products - for pagination with same filters as getAllProducts
exports.loadMoreProducts = [
  cache(300), // Cache for 5 minutes
  async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;
      const categoryId = req.query.category_id;
      const searchQuery = req.query.search;
      const languageId = parseInt(req.query.language_id) || 1;
      
      // Additional filters - same as getAllProducts
      const priceMin = parseFloat(req.query.price_min) || 0;
      const priceMax = parseFloat(req.query.price_max) || Number.MAX_SAFE_INTEGER;
      const manufacturerId = parseInt(req.query.manufacturer_id);
      const stockStatus = req.query.stock_status;
      const sortBy = req.query.sort_by || 'date_added';
      const sortOrder = req.query.sort_order || 'DESC';
      
      // Build query options - same structure as getAllProducts
      const queryOptions = {
        limit,
        offset,
        order: [[sortBy, sortOrder]],
        where: {},
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
            as: 'product_description',
            attributes: ['name', 'meta_title', 'meta_description', 'meta_keyword', 'tag'],
            where: { language_id: languageId },
            required: false
          },
          {
            model: ProductImage,
            as: 'ProductImages',
            attributes: ['image', 'sort_order'],
            required: false
          }
        ],
        distinct: true
      };
      
      // Apply all the same filters as getAllProducts
      // Add price range filter
      queryOptions.where.price = {
        [Op.between]: [priceMin, priceMax]
      };
      
      // Add manufacturer filter if provided
      if (manufacturerId) {
        queryOptions.where.manufacturer_id = manufacturerId;
      }
      
      // Add stock status filter if provided
      if (stockStatus) {
        queryOptions.where.stock_status_id = stockStatus;
      }
      
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
          image: productJson.image ? resizeImage(productJson.image, 200, 200, true) : null,
          mrp: productJson.price, // Original price is MRP
          selling_price: specialPrice, // Special price is selling price
          name: product.product_descriptions && product.product_descriptions.length > 0 
            ? product.product_descriptions[0].name 
            : null,
          description: product.product_descriptions && product.product_descriptions.length > 0 
            ? product.product_descriptions[0].description 
            : null,
          images: product.ProductImages ? product.ProductImages.map(img => ({
            image: img.image ? resizeImage(img.image, 150, 150, true) : null,
            sort_order: img.sort_order || 0
          })) : []
        };
      });

      res.status(200).json({
        success: true,
        count: products.count,
        data: formattedProducts,
        totalPages: Math.ceil(products.count / limit),
        currentPage: page,
        hasMore: page < Math.ceil(products.count / limit)
      });
    } catch (error) {
      console.error('Load more products error:', error);
      res.status(500).json({
        success: false,
        message: 'Could not load more products',
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
            as: 'product_description',
            attributes: ['name', 'description', 'meta_title', 'meta_description', 'meta_keyword', 'tag'],
            where: { language_id: languageId },
            required: false
          },
          {
            model: ProductImage,
            as: 'ProductImages',
            attributes: ['image', 'sort_order'],
            required: false
          },
          {
            model: ProductVariant,
            attributes: ['variant_group_id', 'variant_name', 'variant_image', 'product_id'],
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

      // Get related variants if this product has a variant group
      let relatedVariants = [];
      if (product.product_variants && product.product_variants.length > 0) {
        const variantGroupId = product.product_variants[0].variant_group_id;
        if (variantGroupId) {
          // Find all products in the same variant group
          relatedVariants = await ProductVariant.findAll({
            where: { variant_group_id: variantGroupId },
            include: [{
              model: Product,
              attributes: ['product_id', 'price', 'image']
            }]
          });
        }
      }

      // Format the response data
      const productJson = product.toJSON();
      const specialPrice = product.product_specials && product.product_specials.length > 0 
        ? product.product_specials[0].price 
        : null;
      
      // Format variants with more details
      const variants = relatedVariants.map(variant => {
        const variantProduct = variant.product || {};
        return {
          variant_id: variant.variant_id,
          product_id: variant.product_id,
          name: variant.variant_name,
          image: variant.variant_image,
          size_type: variant.size_type,
          size_value: variant.size_value,
          price: variantProduct.price,
          url: `/product/${variant.product_id}`,
          is_current: variant.product_id === parseInt(req.params.id)
        };
      });

      // Get additional product information
      const sizeChart = await getProductSizeChart(req.params.id);
      const warranty = await getProductWarranty(req.params.id);
      const returnPolicy = await getProductReturnPolicy(req.params.id);
      const faqs = await getProductFAQs(req.params.id);

      // Create optimized response structure
      const formattedProduct = {
        product_id: productJson.product_id,
        model: productJson.model,
        sku: productJson.sku,
        name: product.product_description && product.product_description.length > 0 
          ? product.product_description[0].name 
          : null,
description: product.product_description && product.product_description.length > 0 
          ? sanitizeDescription(product.product_description[0].description)
          : null,
        meta: {
          title: product.product_description && product.product_description.length > 0 
            ? product.product_description[0].meta_title 
            : null,
          description: product.product_description && product.product_description.length > 0 
            ? product.product_description[0].meta_description 
            : null,
          keywords: product.product_description && product.product_description.length > 0 
            ? product.product_description[0].meta_keyword 
            : null
        },
        pricing: {
          mrp: productJson.price,
          selling_price: specialPrice || productJson.price,
          discount_percentage: specialPrice ? Math.round((productJson.price - specialPrice) / productJson.price * 100) : 0
        },
        images: product.ProductImages ? product.ProductImages.map(img => ({
          image: img.image ? resizeImage(img.image, 150, 150,true) : null,
          sort_order: img.sort_order || 0
        })) : [],
        main_image: productJson.image ? resizeImage(productJson.image,500,500,true):null,
        stock: {
          quantity: productJson.quantity,
          status_id: productJson.stock_status_id,
          in_stock: productJson.quantity > 0
        },
        specifications: {
          manufacturer_id: productJson.manufacturer_id,
          weight: productJson.weight,
          weight_class_id: productJson.weight_class_id,
          dimensions: {
            length: productJson.length,
            width: productJson.width,
            height: productJson.height,
            length_class_id: productJson.length_class_id
          }
        },
        additional_info: {
          size_chart: sizeChart ? {
            title: sizeChart.title,
            content: sanitizeDescription(sizeChart.content)
          } : null,
          warranty: warranty ? {
            title: warranty.title,
            content: sanitizeDescription(warranty.content)
          } : null,
          return_policy: returnPolicy ? {
            title: returnPolicy.title,
            content: sanitizeDescription(returnPolicy.content)
          } : null,
          faqs: faqs ? {
            title: faqs.title,
            faqs: faqs.faqs && Array.isArray(faqs.faqs) ? faqs.faqs.map(faq => ({
              question: faq.question,
              answer: sanitizeDescription(faq.answer)
            })) : []
          } : null
        },
        variants: variants,
        viewed: productJson.viewed,
        minimum_quantity: productJson.minimum
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

// Get EMI options from Razorpay
exports.getEmiOptions = async (req, res) => {
  try {
    // Get API key from environment variables for security
    const key_id = process.env.RAZORPAY_KEY_ID;
    const url = "https://api.razorpay.com/v1/methods";
    
    // Use axios for HTTP requests
    const axios = require('axios');
    
    const response = await axios.get(url, {
      auth: {
        username: key_id,
        password: '' // Razorpay uses only key_id for Basic Auth
      },
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    res.status(200).json(response.data);
  } catch (error) {
    console.error('EMI API error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not retrieve EMI options',
      error: error.message
    });
  }
};

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