export const errorHandler = (err, req, res, next) => {
  if (err.name === 'CastError') {
    return res.status(400).json({
      message: 'Invalid resource ID.',
    });
  }
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      message: 'Validation failed.',
      errors: Object.values(err.errors).map((error) => error.message),
    });
  }

  console.error(err);

  res.status(500).json({
    message: 'Internal server error.',
  });
};