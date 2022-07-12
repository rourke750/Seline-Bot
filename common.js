const roleHarvester = require('roles.harvester');
const roleUpgrader = require('roles.upgrader');
const roleBuilder = require('roles.builder');
const roleRepairer = require('roles.repairer');
const roleSmartHarvester = require('roles.smart_harvester');
const roleHauler = require('roles.hauler');

const militaryScout = require('military.scout');
const militaryDefender = require('military.defender');
const militaryTower = require('military.tower');

const common = {
    creepMapping: {
        'harvester' : roleHarvester,
        'upgrader' : roleUpgrader,
        'builder' : roleBuilder,
        'repairer' : roleRepairer,
        'scout' : militaryScout,
        'smartHarvester' : roleSmartHarvester,
        'defender' : militaryDefender,
        'hauler' : roleHauler
    },
    maxConstructionsPerRoom: 5
}

module.exports = common;