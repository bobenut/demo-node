cd ../db/mongo/agenda-data
del /Q /F mongod.lock
cd ..
mongod -f mongodb.cnf