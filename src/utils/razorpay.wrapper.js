/**
 * Razorpay Controller Wrapper
 * Ensures all controller methods are properly defined and handles errors gracefully
 */

/**
 * Wraps controller methods to ensure they exist and handle errors
 * @param {Function} controllerMethod - The controller method to wrap
 * @param {String} methodName - Name of the method for error reporting
 * @returns {Function} Wrapped controller method
 */
const wrapControllerMethod = (controllerMethod, methodName) => {
  return (req, res, next) => {
    try {
      if (typeof controllerMethod === 'function') {
        return controllerMethod(req, res, next);
      } else {
        console.error(`Razorpay controller method '${methodName}' is not defined`);
        return res.status(501).json({
          success: false,
          message: `Payment functionality '${methodName}' is not available`
        });
      }
    } catch (error) {
      console.error(`Error in Razorpay controller method '${methodName}':`, error);
      return res.status(500).json({
        success: false,
        message: 'An error occurred while processing your payment request'
      });
    }
  };
};

module.exports = {
  wrapControllerMethod
};