const Agenda = require('agenda');

var agenda = new Agenda();

module.exports = {
  connect: (connectionString) => {
    agenda.database(connectionString);
  },
  agenda: agenda
}