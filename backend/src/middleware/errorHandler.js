class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.isOperational ? err.message : 'Error interno del servidor';
  if (err.code === '23505') return res.status(409).json({ success: false, error: 'Registro duplicado' });
  if (err.code === '23503') return res.status(400).json({ success: false, error: 'Referencia inválida' });
  res.status(statusCode).json({ success: false, error: message });
};

const logger = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path !== '/health') console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
};

module.exports = { AppError, errorHandler, logger };
