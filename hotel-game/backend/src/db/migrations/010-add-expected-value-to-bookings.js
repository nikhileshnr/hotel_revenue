'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Expected value stored at decision time = revenue_offered × (1 - p_cancel)
    await queryInterface.addColumn('bookings', 'expected_value', {
      type: Sequelize.DECIMAL(12, 2),
      defaultValue: 0,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('bookings', 'expected_value');
  },
};
