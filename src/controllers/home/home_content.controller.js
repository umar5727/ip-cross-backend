const Product = require('../../models/product/product');
const Category = require('../../models/category/category');
const { sequelize } = require('../../config/database');

// Main function to get home content for mobile
exports.getHomeContent = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    const content = await generateHomeContent(page, limit);
    
    res.status(200).json({
      success: true,
      data: content
    });
  } catch (error) {
    console.error('Error fetching home content:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch home content'
    });
  }
};

// Mobile-specific load more function
exports.loadMore = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    const content = await generateHomeContent(page, limit);
    
    res.status(200).json({
      success: true,
      data: content,
      page: page,
      hasMore: content.length === limit
    });
  } catch (error) {
    console.error('Error loading more content:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load more content'
    });
  }
};

// Main content generator
async function generateHomeContent(page, limit) {
  // Get featured categories with products
  const categories = await getFeaturedCategories();
  
  // Format data for mobile display
  return formatForMobile(categories, page, limit);
}

// Get featured categories with their products
async function getFeaturedCategories() {
  // Similar to PHP's buildSubcats function
  const categories = await Category.findAll({
    where: { status: 1, featured: 1 },
    attributes: ['category_id', 'name', 'image'],
    order: [['sort_order', 'ASC']],
    limit: 10
  });
  
  // Get products for each category
  const result = [];
  for (const category of categories) {
    const products = await Product.findAll({
      where: { status: 1 },
      include: [
        {
          model: Category,
          where: { category_id: category.category_id },
          attributes: []
        }
      ],
      attributes: [
        'product_id', 'name', 'image', 'price', 'special',
        'rating', 'date_added'
      ],
      limit: 6
    });
    
    result.push({
      category_id: category.category_id,
      name: category.name,
      image: category.image,
      products: products
    });
  }
  
  return result;
}

// Format data specifically for mobile view
function formatForMobile(categories, page, limit) {
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  
  // Format each category with its products
  const formattedContent = categories.map(category => {
    return {
      type: 'subcategory',
      title: category.name,
      items: category.products.map(product => {
        return {
          product_id: product.product_id,
          name: product.name,
          thumb: product.image ? `/images/${product.image}` : '/images/default.png',
          price: product.price,
          special: product.special || '',
          rating: product.rating || 0,
          href: `/product/${product.product_id}`
        };
      }),
      limit: category.products.length
    };
  });
  
  // Return paginated content
  return formattedContent.slice(startIndex, endIndex);
}