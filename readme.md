# Hipsell Server

This is some basic documentation for `hs-server`.  It's not exhaustive,
but should get the job done.

## Running

Use the standard `node main.js`.  It takes a few optional command line
args, which can be listed by using the `--help` switch.

### Settings

The server uses a unified settings system that's somewhat of a hybrid
between Rails and Django styles.  There's a base `settings.json` file
that specifies the default settings, as well as a few predefined modes.
Default settings are overridden by mode settings, and mode settings are
overwritten by command line settings.

The mode to run in can be specified via the `--mode=[mode]` switch.  If
this is a mode present in `settings.json` the mode settings will be
loaded from there.  Otherwise, the mode is treated as a file name an the
server attempts to open that file and read the mode settings from it.
The default mode the server runs in is `lsettings.json` -- which is to
say, it expects that file to be there by default.

## File Layout

Below is a grouping of files and their purposes; sort of a high level
overview of the codebase.

#### Database

    db.js        - All DB functionality (query, apply, get, etc.)
    models.js    - All DB models and related functionality
    querying.js  - Arbitrary query functionality
    queries/     - Contains query definitions
    migrations/  - DB migrations, which should be directly executable
                   with node, from the migrations directory.  The naming
                   scheme is [desc]-[day]-[month]-[year].js.

#### Settings

    settings.js    - Settings module; import this to gain access to
                     properly-overridden, unified settings.
    settings.json  - Default settings and mode definitions

#### Protocol Related

    clients.js   - Manages active clients and sets up the
                   request/response workflow.
    protocol.js  - Defines the protocol, performs protocol-level
                   validation, and delegates functionality to the
                   appropriate handlers.
    handlers/    - Message handlers

#### Client Library Related

    croquet/    - The messaging interface (similar to socket.io)
    interface/  - Serve the api library to the client

#### HTTP Serving

    urls.js
    static-serving.js
    iapi
    crosspost/

#### Interfacing

    email.js
    phone/

#### Functionality

    presence.js       - Presence support
    notifications.js  - Notifications support

#### Templating

    templating.js  - Main templating functionality
    templates/     - Contains template files

#### Misc

    util/    - Misc. utilty code
    main.js  - Server entry point


## The DB Layer

The way the database is accessed is a little weird due to the way the
server has to operate on data, so the server's DB functionality is
a little different from the norm.

Rather than using the typical "model" approach, we use `FieldSet`s,
which, as the name would imply, and just sets of fields tied to
MongoDB collection names and with some additional functionality.  The
key difference between a `FieldSet` and a model is that a `FieldSet`
represents a *diff* and not the absolute state of a certain DB entity.

In fact the database module provides only one function for saving data:
`apply()`.  This function can be passed multiple `FieldSet`s and it
will apply them as diffs to the database if they have the `_id` field
set, or it will bootstrap (create and `_id` field and a `created` field)
the `FieldSet` and insert it into the database.

The `get` function is similarly weird, in that it simply updates the
content of a `FieldSet` with data from the DB.  Simply pass it a
`FieldSet` with the `_id` field set and the contents will be set before
the callback fires.
