'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Per-week occupancy rate for each player
    await queryInterface.addColumn('weekly_scores', 'occupancy_rate', {
      type: Sequelize.DECIMAL(5, 4),
      defaultValue: 0,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('weekly_scores', 'occupancy_rate');
  },
};
