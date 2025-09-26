const { DataTypes, Op } = require('sequelize');
const sequelize = require('../../../config/database');
const Category = require('./category.model');
const CategoryDescription = require('./category_description.model');
const Product = require('../product/product.model');
const ProductToCategory = require('../product/product_category.model');

// Define methods for all_categories functionality
const AllCategories = {
  /**
   * Get parent ID of a category
   * @param {number} categoryId - The category ID
   * @returns {Promise<number>} - The parent ID
   */
  getCategoryParentId: async (categoryId) => {
    try {
      const category = await Category.findByPk(categoryId, {
        attributes: ['parent_id']
      });
      return category ? category.parent_id : 0;
    } catch (error) {
      console.error('Error in getCategoryParentId:', error);
      throw error;
    }
  },

  /**
   * Get category name by ID
   * @param {number} categoryId - The category ID
   * @param {number} languageId - The language ID
   * @returns {Promise<string>} - The category name
   */
  getCategoryName: async (categoryId, languageId) => {
    try {
      const categoryDesc = await CategoryDescription.findOne({
        where: {
          category_id: categoryId,
          language_id: languageId
        },
        attributes: ['name']
      });
      return categoryDesc ? categoryDesc.name : '';
    } catch (error) {
      console.error('Error in getCategoryName:', error);
      throw error;
    }
  },

  /**
   * Get subcategories of a category
   * @param {number} categoryId - The parent category ID
   * @param {number} languageId - The language ID
   * @returns {Promise<Array>} - List of subcategories
   */
  getSubcategories: async (categoryId, languageId) => {
    try {
      const categories = await Category.findAll({
        where: {
          parent_id: categoryId
        },
        include: [
          {
            model: CategoryDescription,
            as: 'category_descriptions',
            where: {
              language_id: languageId
            },
            attributes: ['name']
          }
        ],
        attributes: ['category_id', 'image'],
        order: [['sort_order', 'ASC']]
      });

      return categories.map(category => ({
        category_id: category.category_id,
        name: category.category_descriptions[0].name,
        image: category.image
      }));
    } catch (error) {
      console.error('Error in getSubcategories:', error);
      throw error;
    }
  },

  /**
   * Get product count for a category
   * @param {number} categoryId - The category ID
   * @returns {Promise<number>} - Number of products in the category
   */
  getProductCountByCategory: async (categoryId) => {
    try {
      // Direct count without association
      const count = await ProductToCategory.count({
        where: {
          category_id: categoryId
        }
      });
      return count;
    } catch (error) {
      console.error('Error in getProductCountByCategory:', error);
      throw error;
    }
  }
};

module.exports = AllCategories;