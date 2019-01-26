# Pull base image.
FROM node:8.15.0-onbuild

# Node base will default the command to `node server.js`.

# Expose port.
EXPOSE 2001 
