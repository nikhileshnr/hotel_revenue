'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('bookings', {
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
      guest_index: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      decision: {
        type: Sequelize.ENUM('accepted', 'rejected', 'timeout'),
        defaultValue: 'timeout',
      },
      room_tier: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      room_number: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      decided_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      outcome: {
        type: Sequelize.ENUM('pending', 'checked_out', 'cancelled', 'no_show'),
        defaultValue: 'pending',
      },
      revenue_realized: {
        type: Sequelize.DECIMAL(12, 2),
        defaultValue: 0,
      },
      resolved_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    await queryInterface.addIndex('bookings', ['week_id', 'user_id'], {
      name: 'idx_bookings_week_user',
    });
    await queryInterface.addIndex('bookings', ['week_id', 'decision'], {
      name: 'idx_bookings_week_decision',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('bookings');
  },
};
