'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('weeks', {
      id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        allowNull: false,
      },
      session_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'game_sessions', key: 'id' },
        onDelete: 'CASCADE',
      },
      week_number: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('pending', 'active', 'resolving', 'completed'),
        defaultValue: 'pending',
      },
      simulated_month: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      guest_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      guests_json: {
        type: Sequelize.JSON,
        allowNull: false,
      },
      started_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      ended_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    await queryInterface.addIndex('weeks', ['session_id', 'week_number'], {
      name: 'idx_weeks_session_week',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('weeks');
  },
};
