'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('game_sessions', 'game_mode', {
      type: Sequelize.ENUM('pricing', 'classic'),
      allowNull: false,
      defaultValue: 'pricing',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('game_sessions', 'game_mode');
    // Clean up ENUM type (MySQL doesn't need this, but good practice)
  },
};
