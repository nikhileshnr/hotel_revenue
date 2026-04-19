'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 7-day occupancy grid per tier
    await queryInterface.addColumn('player_states', 'week_calendar', {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: null,
    });

    // Running average occupancy rate
    await queryInterface.addColumn('player_states', 'occupancy_rate', {
      type: Sequelize.DECIMAL(5, 4),
      defaultValue: 0,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('player_states', 'week_calendar');
    await queryInterface.removeColumn('player_states', 'occupancy_rate');
  },
};
