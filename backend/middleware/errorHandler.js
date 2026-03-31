function errorHandler(err, req, res, next) {
  const statusCode = Number(err?.statusCode || err?.status || 500);
  const message = err?.message || 'Internal Server Error';

  if (statusCode >= 500) {
    console.error('Unhandled error', err);
  } else {
    console.warn('Request error', {
      method: req.method,
      url: req.originalUrl,
      statusCode,
      message,
    });
  }

  res.status(statusCode).json({
    error: message,
    stack: process.env.NODE_ENV === 'development' ? err?.stack : undefined,
  });
}

module.exports = errorHandler;
