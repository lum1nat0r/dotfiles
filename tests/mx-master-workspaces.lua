-- Run from the repository root: lua tests/mx-master-workspaces.lua
local callbacks = {}
local current, workspaces, dispatched
local function inert() end
local hl = {
    monitor = inert, on = inert, env = inert, config = inert,
    curve = inert, animation = inert, layer_rule = inert,
    gesture = inert, device = inert, window_rule = inert,
    exec_cmd = function() error("configuration must not execute commands") end,
    bind = function(key, callback) callbacks[key] = callback end,
    get_active_workspace = function() return current end,
    get_workspaces = function() return workspaces end,
    dispatch = function(target)
        dispatched[#dispatched + 1] = target.workspace
    end,
    dsp = {
        exec_cmd = inert, layout = inert,
        focus = function(target) return target end,
        window = { close = inert, pseudo = inert, move = inert,
                   drag = inert, resize = inert },
        workspace = { toggle_special = inert },
    },
}
local environment = {
    hl = hl, ipairs = ipairs,
    os = { getenv = function(key)
        assert(key == "HOME")
        return "/isolated-home"
    end },
}
assert(loadfile("E14/.config/hypr/hyprland.lua", "t", environment))()

local function workspace(id, monitorId, configName, special, empty)
    return {
        id = id, monitor = monitorId and { id = monitorId } or nil,
        config_name = configName or tostring(id), special = special or false,
        is_empty = empty or false,
    }
end

local checks = 0
local keycodes = { F13 = "code:191", F14 = "code:192" }
local function expect(label, active, candidates, key, expected)
    current, workspaces, dispatched = active, candidates, {}
    callbacks[keycodes[key]]()
    if expected then
        assert(#dispatched == 1 and dispatched[1] == expected,
            label .. ": expected exactly one focus to " .. expected)
    else
        assert(#dispatched == 0, label .. ": expected no dispatch")
    end
    checks = checks + 1
end

-- Separate monitor objects with equal IDs must still match.
local one, three, five = workspace(1, 0), workspace(3, 0), workspace(5, 0)
local sparse = { five, one, three }
expect("sparse left", three, sparse, "F13", "1")
expect("sparse right", three, sparse, "F14", "5")
expect("no wrap left", one, sparse, "F13")
expect("no wrap right", five, sparse, "F14")
expect("single left", three, { three }, "F13")
expect("single right", three, { three }, "F14")

local filtered = {
    workspace(4, 1), workspace(4, 0, "special:overlay", true),
    workspace(2, 1), workspace(2, 0, "special:other", true),
    five, one, three,
}
expect("ignore foreign and special right", three, filtered, "F14", "5")
expect("ignore foreign and special left", three, filtered, "F13", "1")
expect("single monitor ignores others left", three,
    { three, workspace(1, 1), workspace(5, 1) }, "F13")
expect("single monitor ignores others right", three,
    { three, workspace(1, 1), workspace(5, 1) }, "F14")
expect("existing empty workspace", three,
    { three, workspace(7, 0, "7", false, true) }, "F14", "7")

for _, key in ipairs({ "F13", "F14" }) do
    expect("missing active " .. key, nil, sparse, key)
    expect("missing active monitor " .. key, workspace(3), sparse, key)
    expect("missing candidate monitor " .. key, three,
        { three, workspace(1), workspace(5) }, key)
end
expect("skip monitorless nearer candidate", three,
    { three, workspace(4), five }, "F14", "5")

local named = workspace(-1337, 0, "name:project")
expect("named canonical selector", one, { named, one, three }, "F13", "name:project")
expect("named to numbered", named, { three, one, named }, "F14", "1")
expect("named left boundary", named, { named, one }, "F13")
print(("PASS: %d workspace selection checks"):format(checks))
