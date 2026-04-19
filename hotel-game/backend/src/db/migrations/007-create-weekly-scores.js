'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('weekly_scores', {
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
      week_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'weeks', key: 'id' },
        onDelete: 'CASCADE',
      },
      user_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      week_revenue: {
        type: Sequelize.DECIMAL(12, 2),
        defaultValue: 0,
      },
      cumulative_revenue: {
        type: Sequelize.DECIMAL(12, 2),
        defaultValue: 0,
      },
      guests_accepted: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      guests_rejected: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      cancellations: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      no_shows: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex('weekly_scores', ['session_id', 'user_id'], {
      name: 'idx_weekly_scores_session_user',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('weekly_scores');
  },
};
