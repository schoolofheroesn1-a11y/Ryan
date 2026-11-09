// Точка входа для хостинга (Node.js-приложение). Запускает собранный сайт.
process.env.NODE_ENV = 'production';
import('./dist-server/index.js');
