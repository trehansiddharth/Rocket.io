#!/bin/bash

stop snapsync
rm -r "$HOME/.snapsync/"
rm "$HOME/.config/upstart/snapsync.conf"

echo "SnapSync has been removed successfully"
