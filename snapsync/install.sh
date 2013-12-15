#!/bin/bash -e

sudo sed -i "s/^#ubuntu/ubuntu/" /etc/upstart-xsessions
mkdir "$HOME/.snapsync/"
mkdir "$HOME/.snapsync/projects/"
cp -r node_modules/ "$HOME/.snapsync/"
cp package.json "$HOME/.snapsync/"
cp snapsync.js "$HOME/.snapsync/"
cp node-snapsync "$HOME/.snapsync/"
cp snapsync.sh "$HOME/.snapsync/"
cp snapsync.conf "$HOME/.config/upstart/"
start snapsync

echo "SnapSync has been installed successfully."
