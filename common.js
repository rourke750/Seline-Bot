const roleHarvester = require('roles.harvester');
const roleUpgrader = require('roles.upgrader');
const roleBuilder = require('roles.builder');
const roleRepairer = require('roles.repairer');
const roleSmartHarvester = require('roles.smart_harvester');
const roleHauler = require('roles.hauler');

const militaryClaimer = require('military.claimer');
const militaryDefender = require('military.defender');
const militaryTower = require('military.tower');

const common = {
    creepMapping: {
        'harvester' : roleHarvester,
        'upgrader' : roleUpgrader,
        'builder' : roleBuilder,
        'repairer' : roleRepairer,
        'claimer' : militaryClaimer,
        'smartHarvester' : roleSmartHarvester,
        'defender' : militaryDefender,
        'hauler' : roleHauler
    },
    maxConstructionsPerRoom: 5
}

module.exports = common;