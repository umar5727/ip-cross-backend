const HomeContentService = require('../../services/home-content.service');

// Get initial home content data
exports.getHomeContent = async (req, res) => {
  try {
    // Section 1: Get subcategories for category 2123 with price and rating
    const category_id1 = 2123;
    const subcategories1 = await HomeContentService.getSubCategoriesWithPriceAndRating(category_id1, 6);
    
    // Get popular brands
    const popularBrands = await HomeContentService.getPopularBrands(20);

    // Format response similar to OpenCart structure
    const data = {
      category_name1: subcategories1.length > 0 ? subcategories1[0].parent_name : '',
      subcategories1: subcategories1.map(subcat => ({
        name: subcat.subcategory_name,
        thumb: subcat.image ? `${process.env.BASE_URL || 'http://localhost:3000'}/image/${subcat.image}` : null,
        href: `/category/${subcat.category_id}`,
        price: subcat.lowest_price,
        rating: subcat.highest_rating || 0
      })),
      popular_brands: popularBrands.map(brand => ({
        name: brand.name,
        image: brand.image ? `${process.env.BASE_URL || 'http://localhost:3000'}/image/${brand.image}` : null,
        href: brand.href
      }))
    };

    res.json({
      success: true,
      data: data
    });

  } catch (error) {
    console.error('Home content error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch home content'
    });
  }
};

// Load more content for mobile
exports.loadMore = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    
    // Calculate pagination similar to OpenCart
    let limit, start;
    if (page <= 2) {
      limit = 2;
      start = (page - 1) * 2;
    } else {
      limit = 1;
      start = 4 + (page - 3);
    }

    // Page-wise image sizes for mobile
    const pageImageSizes = {
      1: { w: 200, h: 200 },
      2: { w: 130, h: 130 }
    };

    const pageImageSizesP = {
      1: { w: 130, h: 130 },
      2: { w: 240, h: 240 }
    };

    const imgW = pageImageSizes[page]?.w || 200;
    const imgH = pageImageSizes[page]?.h || 200;
    const imgWp = pageImageSizesP[page]?.w || 200;
    const imgHp = pageImageSizesP[page]?.h || 200;

    // Section mapping for mobile
    const sections = {
      'Beauty & Personal Care': 2167,
      'Men': 2104,
      'Electronics': 1887,
      'Women Wear': 3106,
      'Kids': 2141,
      'Sports': 2374,
      'Beauty': 2166,
      'Water Bottles': 3058,
      'Footwear': 2112,
      'Home & Kitchen': 1999,
      'Pet Supplies': 2484,
      'Grocery & Gourmet Foods': 2254,
      'Toys & Games': 2352,
      'Baby Products': 2618
    };

    const sectionEntries = Object.entries(sections);
    const pagedSections = sectionEntries.slice(start, start + limit);

    if (pagedSections.length === 0) {
      return res.json([]);
    }

    const result = { sections: [] };
    let index = start;

    for (const [name, categoryId] of pagedSections) {
      // Determine card limit based on index
      let cardLimit = 4;
      if (index === 0) cardLimit = 6;
      else if (index === 1) cardLimit = 8;
      else if (index === 2) cardLimit = 6;
      else if (index === 3) cardLimit = 3;
      else if (index === 4) cardLimit = 6;

      let items = [];
      let type = 'subcategory';

      // Logic for determining content type
      if (index >= 4) {
        // Always subcategories for index >= 4
        items = await HomeContentService.getAllSubCategoriesByParent(categoryId, 0, cardLimit);
        items = HomeContentService.formatForMobile(items, imgW, imgH);
        
        if (index >= 5 && items.length === 3) {
          items = items.slice(0, 2);
        }
      } else {
        // Alternate between subcategories and products for early indices
        if (index % 2 === 0) {
          // Even indices: subcategories
          items = await HomeContentService.getAllSubCategoriesByParent(categoryId, 0, cardLimit);
          items = HomeContentService.formatForMobile(items, imgW, imgH);
        } else {
          // Odd indices: products
          type = 'product';
          items = await HomeContentService.getProductsByCategory(categoryId, 0, cardLimit);
          items = HomeContentService.formatForMobile(items, imgWp, imgHp);
        }
      }

      result.sections.push({
        type: type,
        title: name,
        items: items,
        limit: cardLimit
      });

      index++;
    }

    res.json(result);

  } catch (error) {
    console.error('Load more mobile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load more content'
    });
  }
};

// Load more content for desktop
exports.loadMoreD = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    
    // Calculate pagination similar to OpenCart
    let limit, start;
    if (page <= 2) {
      limit = 2;
      start = (page - 1) * 2;
    } else {
      limit = 1;
      start = 4 + (page - 3);
    }

    // Page-wise image sizes for desktop
    const pageImageSizes = {
      1: { w: 140, h: 140 },
      2: { w: 210, h: 210 }
    };

    const imgW = pageImageSizes[page]?.w || 200;
    const imgH = pageImageSizes[page]?.h || 200;

    // Section mapping for desktop (different from mobile)
    const sections = {
      'Trending Footwear Collection': [2112, 2131],
      'Men\'s Fashion & Lifestyle': 2103,
      'Latest Electronics & Gadgets': 1887,
      'Trendy Men\'s Wear': 2104,
      'Explore the Fashion Store': [2102, 2104],
      'Kids Fashion & Accessories': [2141, 2352],
      'Exclusive Beauty Picks': 2166,
      'Home & Kitchen Essentials': 1999,
      'Everything for Your Pets': 2484,
      'Groceries & Daily Needs': [2254, 2256, 2257],
      'Baby Care & Essentials': 2618
    };

    const sectionEntries = Object.entries(sections);
    const pagedSections = sectionEntries.slice(start, start + limit);

    if (pagedSections.length === 0) {
      return res.json([]);
    }

    const result = { sections: [] };
    let index = start;

    for (const [name, categoryIds] of pagedSections) {
      // Determine card limit based on index
      let cardLimit = 5;
      if (index === 0) cardLimit = 5;
      else if (index === 1) cardLimit = 8;
      else if (index === 2) cardLimit = 5;
      else if (index === 3) cardLimit = 5;
      else if (index === 4) cardLimit = 8;

      // Check for custom card limit in query params
      if (req.query.card_limit && req.query.card_limit[index]) {
        cardLimit = parseInt(req.query.card_limit[index]);
      }

      let items = [];
      let type = 'subcategory';

      // Handle multiple category IDs for desktop
      const categoryIdArray = Array.isArray(categoryIds) ? categoryIds : [categoryIds];
      
      // Logic for determining content type
      if (index >= 4) {
        // Always subcategories for index >= 4
        const allItems = [];
        for (const catId of categoryIdArray) {
          const catItems = await HomeContentService.getAllSubCategoriesByParent(catId, 0, cardLimit);
          allItems.push(...catItems);
        }
        items = HomeContentService.formatForDesktop(allItems.slice(0, cardLimit), imgW, imgH);
        
        if (index >= 5 && items.length === 3) {
          items = items.slice(0, 2);
        }
      } else {
        // Alternate between subcategories and products for early indices
        if (index % 2 === 0) {
          // Even indices: subcategories
          const allItems = [];
          for (const catId of categoryIdArray) {
            const catItems = await HomeContentService.getAllSubCategoriesByParent(catId, 0, cardLimit);
            allItems.push(...catItems);
          }
          items = HomeContentService.formatForDesktop(allItems.slice(0, cardLimit), imgW, imgH);
        } else {
          // Odd indices: products
          type = 'product';
          const allItems = [];
          for (const catId of categoryIdArray) {
            const catItems = await HomeContentService.getProductsByCategory(catId, 0, cardLimit);
            allItems.push(...catItems);
          }
          items = HomeContentService.formatForDesktop(allItems.slice(0, cardLimit), imgW, imgH);
        }
      }

      result.sections.push({
        type: type,
        title: name,
        items: items,
        limit: cardLimit
      });

      index++;
    }

    res.json(result);

  } catch (error) {
    console.error('Load more desktop error:', error);
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
    where: { 
      status: 1,
      top: 1 // Changed from 'featured' to 'top' as this field exists in the Category model
    },
    include: [{
      model: CategoryDescription,
      where: { language_id: 1 },
      attributes: ['name'],
      required: false
    }],
    attributes: ['category_id', 'image'], // Removed 'name' as it doesn't exist in Category model
    order: [['sort_order', 'ASC']],
    limit: 10
  });
  
  // Get products for each category using the many-to-many relationship
  const result = [];
  for (const category of categories) {
    const products = await Product.findAll({
      where: { status: 1 },
      include: [
        {
          model: Category,
          where: { category_id: category.category_id },
          attributes: [],
          through: { attributes: [] } // Exclude junction table attributes
        },
        {
          model: ProductDescription,
          as: 'product_description',
          where: { language_id: 1 },
          attributes: ['name'],
          required: false
        }
      ],
      attributes: [
        'product_id', 'image', 'price', 'viewed',
        'date_added'
      ],
      limit: 10
    });
    
    result.push({
      category_id: category.category_id,
      name: category.category_descriptions && category.category_descriptions.length > 0 
        ? category.category_descriptions[0].name 
        : `Category ${category.category_id}`,
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
          name: product.product_description && product.product_description.length > 0 
            ? product.product_description[0].name 
            : `Product ${product.product_id}`,
          thumb: product.image ? `https://your-domain.com/images/${product.image}` : null,
          price: product.price,
          special: null, // Will be calculated from ProductSpecial if needed
          rating: 0, // Default rating
          href: `https://your-domain.com/product/${product.product_id}`
        };
      }),
      limit: category.products.length
    };
  });
  
  // Return paginated content
  return formattedContent.slice(startIndex, endIndex);
}