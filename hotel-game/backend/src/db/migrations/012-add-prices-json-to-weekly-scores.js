'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('weekly_scores', 'prices_json', {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: null,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('weekly_scores', 'prices_json');
  },
};
