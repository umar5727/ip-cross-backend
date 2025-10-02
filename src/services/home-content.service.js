const { Category, CategoryDescription, Product, ProductDescription, ProductSpecial, ProductCategory } = require('../models');
const { Op, Sequelize } = require('sequelize');
const { redisClient } = require('../../config/redis');
const { resizeImage } = require('../utils/image');

class HomeContentService {
  constructor() {
    this.cacheTimeout = 3600; // 1 hour cache
  }

  /**
   * Get subcategories with price and rating for initial home content
   * Migrated from getSubCategoriesWithPriceAndRating()
   */
  async getSubCategoriesWithPriceAndRating(categoryId, limit = 6) {
    const cacheKey = `home_subcats_${categoryId}_${limit}`;
    
    try {
      // Check cache first
      if (redisClient && redisClient.connected) {
        try {
          const cached = await new Promise((resolve, reject) => {
            redisClient.get(cacheKey, (err, result) => {
              if (err) reject(err);
              else resolve(result);
            });
          });
          
          if (cached) {
            return JSON.parse(cached);
          }
        } catch (cacheError) {
          console.log('Cache get error:', cacheError);
        }
      }

      const subcategories = await Category.findAll({
        where: { parent_id: categoryId, status: 1 },
        include: [
          {
            model: CategoryDescription,
            as: 'category_descriptions',
            where: { language_id: 1 },
            attributes: ['name'],
            required: true
          },
          {
            model: Product,
            through: { attributes: [] }, // This excludes the junction table attributes
            where: { 
              status: 1,
              date_available: { [Op.lte]: new Date() }
            },
            include: [
              {
                model: ProductSpecial,
                as: 'ProductSpecials',
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
                },
                required: false
              }
            ],
            required: false
          }
        ],
        limit: limit,
        order: [['sort_order', 'ASC']]
      });

      // Get parent category name
      const parentCategory = await Category.findByPk(categoryId, {
        include: [{
          model: CategoryDescription,
          as: 'category_descriptions',
          where: { language_id: 1 },
          attributes: ['name']
        }]
      });

      const result = subcategories.map(subcat => {
        const products = subcat.products || [];
        
        // Calculate lowest price (considering special prices)
        let lowestPrice = null;
        let highestRating = 0;

        products.forEach(product => {
          const specialPrice = product.ProductSpecials?.[0]?.price;
          const price = specialPrice || product.price;
          
          if (lowestPrice === null || price < lowestPrice) {
            lowestPrice = price;
          }

          // Default rating to 0 since Review model doesn't exist
          const avgRating = 0;
          
          if (avgRating > highestRating) {
            highestRating = avgRating;
          }
        });

        return {
          category_id: subcat.category_id,
          subcategory_name: subcat.category_descriptions?.[0]?.name || '',
          image: subcat.image,
          lowest_price: lowestPrice,
          highest_rating: Math.round(highestRating),
          parent_name: parentCategory?.category_descriptions?.[0]?.name || ''
        };
      }).filter(item => item.lowest_price !== null);

      // Cache the result
      if (redisClient && redisClient.connected && result.length > 0) {
        try {
          redisClient.setex(cacheKey, 1800, JSON.stringify(result)); // Cache for 30 minutes
        } catch (cacheError) {
          console.log('Cache set error:', cacheError);
        }
      }
      
      return result;
    } catch (error) {
      console.error('Error getting subcategories with price and rating:', error);
      throw error;
    }
  }

  /**
   * Get all subcategories by parent with lowest price
   * Migrated from getAllSubCategoriesByParent()
   */
  async getAllSubCategoriesByParent(parentIds, start = 0, limit = 4) {
    if (!Array.isArray(parentIds)) {
      parentIds = [parentIds];
    }

    const cacheKey = `home_subcats_parent_${parentIds.join('_')}_${start}_${limit}`;
    
    try {
      // Check cache first
      if (redisClient && redisClient.connected) {
        try {
          const cached = await new Promise((resolve, reject) => {
            redisClient.get(cacheKey, (err, result) => {
              if (err) reject(err);
              else resolve(result);
            });
          });
          
          if (cached) {
            return JSON.parse(cached);
          }
        } catch (cacheError) {
          console.log('Cache get error:', cacheError);
        }
      }

      const subcategories = await Category.findAll({
        where: { 
          parent_id: { [Op.in]: parentIds },
          status: 1 
        },
        include: [
          {
            model: CategoryDescription,
            as: 'category_descriptions',
            where: { language_id: 1 },
            attributes: ['name'],
            required: true
          }
        ],
        offset: start,
        limit: limit,
        order: [['sort_order', 'ASC']]
      });

      const result = await Promise.all(subcategories.map(async (subcat) => {
        // Get all products for this category with their specials
        const productsInCategory = await Product.findAll({
          include: [
            {
              model: Category,
              where: { category_id: subcat.category_id }
            },
            {
              model: ProductSpecial,
              as: 'ProductSpecials',
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
              },
              required: false
            }
          ],
          where: { status: 1 }
        });

        // Find the product with the lowest price (considering specials)
        let lowestPrice = null;
        let lowestPriceQuery = null;
        
        for (const product of productsInCategory) {
          const specialPrice = product.ProductSpecials?.[0]?.price;
          const effectivePrice = specialPrice || product.price;
          
          if (lowestPrice === null || effectivePrice < lowestPrice) {
            lowestPrice = effectivePrice;
            lowestPriceQuery = product;
          }
        }

        return {
          category_id: subcat.category_id,
          name: subcat.category_descriptions?.[0]?.name || '',
          image: subcat.image,
          lowest_price: lowestPrice
        };
      }));

      // Filter out categories without products/prices
      const filteredResult = result.filter(item => item.lowest_price !== null && item.lowest_price !== undefined);

      // Cache the result
      if (redisClient && redisClient.connected && filteredResult.length > 0) {
        try {
          redisClient.setex(cacheKey, 1800, JSON.stringify(filteredResult)); // Cache for 30 minutes
        } catch (cacheError) {
          console.log('Cache set error:', cacheError);
        }
      }
      
      return filteredResult;
    } catch (error) {
      console.error('Error getting subcategories by parent:', error);
      throw error;
    }
  }

  /**
   * Get products by category with special prices and ratings
   * Migrated from getProductsByCategory()
   */
  async getProductsByCategory(categoryId, start = 0, limit = 4, order = 'ASC', sort = 'price') {
    const cacheKey = `home_products_${categoryId}_${start}_${limit}_${sort}_${order}`;
    
    try {
      // Check cache first
      if (redisClient && redisClient.connected) {
        try {
          const cached = await new Promise((resolve, reject) => {
            redisClient.get(cacheKey, (err, result) => {
              if (err) reject(err);
              else resolve(result);
            });
          });
          
          if (cached) {
            return JSON.parse(cached);
          }
        } catch (cacheError) {
          console.log('Cache get error:', cacheError);
        }
      }

      // Get child categories using category path
      const childCategories = await Category.findAll({
        where: { parent_id: categoryId, status: 1 },
        attributes: ['category_id']
      });

      const categoryIds = [categoryId, ...childCategories.map(cat => cat.category_id)];
      
      const products = await Product.findAll({
        include: [
          {
            model: Category,
            through: { 
              attributes: [],
              where: { category_id: { [Op.in]: categoryIds } }
            }
          },
          {
            model: ProductDescription,
            as: 'product_description',
            where: { language_id: 1 },
            attributes: ['name'],
            required: true
          },
          {
            model: ProductSpecial,
            as: 'ProductSpecials',
            where: {
              [Op.or]: [
                {
                  [Op.and]: [
                    { date_start: '0000-00-00' },
                    { date_end: '0000-00-00' }
                  ]
                },
                {
                  [Op.and]: [
                    { date_start: { [Op.lte]: new Date() } },
                    { date_end: { [Op.gte]: new Date() } }
                  ]
                },
                {
                  [Op.and]: [
                    { date_start: '0000-00-00' },
                    { date_end: { [Op.gte]: new Date() } }
                  ]
                },
                {
                  [Op.and]: [
                    { date_start: { [Op.lte]: new Date() } },
                    { date_end: '0000-00-00' }
                  ]
                }
              ]
            },
            required: false,
            order: [['priority', 'ASC'], ['price', 'ASC']]
          }
        ],
        where: { 
          status: 1,
          date_available: { [Op.lte]: new Date() }
        },
        offset: start,
        limit: limit,
        order: sort === 'price' ? [] : [[sort, order]] // Remove complex price ordering
      });

      // Sort by price manually if needed
      if (sort === 'price') {
        products.sort((a, b) => {
          const priceA = a.ProductSpecials?.[0]?.price || a.price;
          const priceB = b.ProductSpecials?.[0]?.price || b.price;
          return order === 'ASC' ? priceA - priceB : priceB - priceA;
        });
      }

      const result = products.map(product => {
        const specialPrice = product.ProductSpecials?.[0]?.price;
        // Default rating to 0 since Review model doesn't exist
        const avgRating = 0;

        return {
          product_id: product.product_id,
          name: product.product_description?.[0]?.name || '',
          image: product.image,
          price: product.price,
          special: specialPrice || null,
          rating: avgRating
        };
      });

      // Cache the result
      if (redisClient && redisClient.connected && result.length > 0) {
        try {
          redisClient.setex(cacheKey, this.cacheTimeout, JSON.stringify(result));
        } catch (cacheError) {
          console.log('Cache set error:', cacheError);
        }
      }
      
      return result;
    } catch (error) {
      console.error('Error getting products by category:', error);
      throw error;
    }
  }

  /**
   * Get popular brands data
   * Since Manufacturer model doesn't exist, return empty array
   */
  async getPopularBrands(limit = 20) {
    const cacheKey = `popular_brands_${limit}`;
    
    try {
      // Check cache first
      if (redisClient && redisClient.connected) {
        try {
          const cached = await new Promise((resolve, reject) => {
            redisClient.get(cacheKey, (err, result) => {
              if (err) reject(err);
              else resolve(result);
            });
          });
          
          if (cached) {
            return JSON.parse(cached);
          }
        } catch (cacheError) {
          console.log('Cache get error:', cacheError);
        }
      }

      // Since Manufacturer model doesn't exist, return empty array
      const result = [];

      // Cache the result
      if (redisClient && redisClient.connected) {
        try {
          redisClient.setex(cacheKey, this.cacheTimeout, JSON.stringify(result));
        } catch (cacheError) {
          console.log('Cache set error:', cacheError);
        }
      }
      
      return result;
    } catch (error) {
      console.error('Error getting popular brands:', error);
      throw error;
    }
  }

  /**
   * Format data for mobile response
   */
  formatForMobile(data, imageWidth = 200, imageHeight = 200) {
    return data.map(item => ({
      ...item,
      thumb: item.image ? resizeImage(item.image, imageWidth, imageHeight, true) : null,
      href: item.href || (item.category_id ? `/category/${item.category_id}` : `/product/${item.product_id}`)
    }));
  }

  /**
   * Format data for desktop response
   */
  formatForDesktop(data, imageWidth = 140, imageHeight = 140) {
    return data.map(item => ({
      ...item,
      thumb: item.image ? resizeImage(item.image, imageWidth, imageHeight, true) : null,
      href: item.href || (item.category_id ? `/category/${item.category_id}` : `/product/${item.product_id}`)
    }));
  }
}

module.exports = new HomeContentService();