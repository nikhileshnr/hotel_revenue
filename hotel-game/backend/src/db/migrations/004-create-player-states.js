'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('player_states', {
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
      user_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      total_revenue: {
        type: Sequelize.DECIMAL(12, 2),
        defaultValue: 0,
      },
      rooms_occupied: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex('player_states', ['session_id', 'user_id'], {
      unique: true,
      name: 'idx_player_states_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('player_states');
  },
};
