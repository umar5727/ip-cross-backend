const AllCategoriesModel = require('../../models/category/all_categories.model');
const { resizeImage } = require('../../utils/image');

// Define sections with their IDs and images
const sections = {
  'Footwear': {
    ids: [2112, 2131, 3223],
    image: "catalog/banners/category/mens_formal_shoes.png"
  },
  'Electronics': {
    ids: [1887],
    image: 'catalog/banners/category/Electronics.png'
  },
  'Clothes': {
    ids: [2104, 2123, 2142],
    image: 'catalog/banners/category/H_M_Casual_Dress.png'
  },
  'bags': {
    ids: [3296, 3567],
    image: 'catalog/banners/category/Handbags.png'
  },
  'Home Appliances': {
    ids: [2006],
    image: 'catalog/banners/category/Home Appliances.png'
  },
  'Grocery & Gourmet Foods': {
    ids: [2254],
    image: 'catalog/banners/category/Grocery_and_gourments_foods.png'
  },
  'Pet Supplies': {
    ids: [2484],
    image: 'catalog/banners/category/Pet Supplies.png'
  },
  'Beauty & Personal Care': {
    ids: [2166],
    image: 'catalog/banners/category/beauty___personal_care.png'
  }
};

exports.getAllCategories = async (req, res) => {
  try {
    // Format sections for response
    const formattedSections = Object.entries(sections).map(([name, info]) => ({
      name,
      href: 'javascript:void(0);',
      cat_ids: info.ids.join(','),
      thumb: resizeImage(info.image, 38, 38, true),
      banner: info.banner ? resizeImage(info.banner, 800, 200, true) : null
    }));

    // Check if group_ids are provided in the query
    let categoriesWithChildren = [];
    if (req.query.group_ids) {
      const groupIds = req.query.group_ids.split(',').map(id => parseInt(id));
      categoriesWithChildren = await getCategoriesData(groupIds, req.query.language_id || 1);
    }

    // If it's an AJAX request, return only the categories data
    if (req.query.ajax) {
      return res.json(categoriesWithChildren);
    }

    // Otherwise return the full response
    return res.json({
      sections: formattedSections,
      categories_with_children: categoriesWithChildren
    });
  } catch (error) {
    console.error('Error in getAllCategories:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching categories',
      error: error.message
    });
  }
};

/**
 * Get categories data with their children
 * @param {Array} groupIds - Array of category IDs
 * @param {number} languageId - Language ID
 * @returns {Promise<Array>} - Categories with their children
 */
async function getCategoriesData(groupIds, languageId) {
  try {
    const categoriesWithChildren = [];

    for (const gid of groupIds) {
      const parentId = await AllCategoriesModel.getCategoryParentId(gid);

      if (parentId === 0) {
        // This is a top-level category, get its subcategories
        const subcategories = await AllCategoriesModel.getSubcategories(gid, languageId);

        for (const sub of subcategories) {
          const subSubcategories = await AllCategoriesModel.getSubcategories(sub.category_id, languageId);
          const childrenList = [];

          for (const child of subSubcategories) {
            const productCount = await AllCategoriesModel.getProductCountByCategory(child.category_id, true);
            if (productCount > 0) {
              childrenList.push({
                name: child.name,
                thumb: child.image ? resizeImage(child.image, 100, 100, true) : 'placeholder.png',
                category_id: child.category_id
              });
            }
          }

          if (childrenList.length > 0) {
            categoriesWithChildren.push({
              heading: sub.name,
              children: childrenList
            });
          }
        }
      } else {
        // This is a subcategory, get its children
        const children = await AllCategoriesModel.getSubcategories(gid, languageId);
        const childrenList = [];

        for (const child of children) {
          const productCount = await AllCategoriesModel.getProductCountByCategory(child.category_id, true);
          if (productCount > 0) {
            childrenList.push({
              name: child.name,
              thumb: child.image ? resizeImage(child.image, 100, 100, true) : 'placeholder.png',
              category_id: child.category_id
            });
          }
        }

        if (childrenList.length > 0) {
          const categoryName = await AllCategoriesModel.getCategoryName(gid, languageId);
          categoriesWithChildren.push({
            heading: categoryName,
            children: childrenList
          });
        }
      }
    }

    return categoriesWithChildren;
  } catch (error) {
    console.error('Error in getCategoriesData:', error);
    throw error;
  }
}