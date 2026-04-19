'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('game_sessions', {
      id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      hotel_type: {
        type: Sequelize.ENUM('city', 'resort'),
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('active', 'paused', 'completed'),
        allowNull: false,
        defaultValue: 'active',
      },
      current_week: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      total_weeks: {
        type: Sequelize.INTEGER,
        defaultValue: 20,
      },
      simulated_month: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      started_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      completed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('game_sessions');
  },
};
