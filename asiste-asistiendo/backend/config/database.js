/**
 * Configuración de PostgreSQL con Sequelize
 *
 * Conexión a base de datos PostgreSQL
 */
const { Sequelize } = require('sequelize');

// Configuración desde variables de entorno
const config = {
    database: process.env.DB_NAME || 'facial_auth',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
};

// Crear instancia de Sequelize
const sequelize = new Sequelize(
    config.database,
    config.username,
    config.password,
    {
        host: config.host,
        port: config.port,
        dialect: config.dialect,
        logging: config.logging,
        pool: config.pool,
        define: {
            timestamps: true,
            underscored: true // snake_case para columnas
        }
    }
);

// Función para probar conexión
const testConnection = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ PostgreSQL conectado correctamente');
        return true;
    } catch (error) {
        console.error('❌ Error conectando a PostgreSQL:', error.message);
        return false;
    }
};

// Sincronizar modelos con la base de datos
const syncDatabase = async (force = false) => {
    try {
        await sequelize.sync({ force });
        console.log('✅ Modelos sincronizados con la base de datos');
    } catch (error) {
        console.error('❌ Error sincronizando modelos:', error.message);
        throw error;
    }
};

module.exports = {
    sequelize,
    testConnection,
    syncDatabase,
    Sequelize
};
