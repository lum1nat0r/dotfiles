import QtQuick
import QtTest

TestCase {
    id: test
    name: "Greeter"
    width: 640
    height: 480
    visible: true
    when: windowShown

    QtObject {
        id: backend
        property bool canPowerOff: false
        property bool canReboot: false
        signal loginFailed()
        signal loginSucceeded()
        signal informationMessage(string message)
        function login(user, password, session) { }
    }
    QtObject { id: users; property string lastUser: "demo" }
    ListModel {
        id: sessions
        property int lastIndex: 0
    }
    QtObject {
        id: keys
        property bool enabled: true
        property var layouts: [{shortName: "de"}, {shortName: "us"}]
        property int currentLayout: 0
        property bool capsLock: false
    }
    Loader {
        id: loader
        anchors.fill: parent
        active: false
        property var sddm: backend
        property var userModel: users
        property var sessionModel: sessions
        property var keyboard: keys
        source: "../e14-glass/Main.qml"
    }

    function field(name) { return findChild(loader.item, name); }
    function typeText(text) {
        for (let i = 0; i < text.length; ++i)
            keyClick(text.charAt(i));
    }
    function loadTheme() {
        loader.active = true;
        tryCompare(loader, "status", Loader.Ready);
        verify(waitForRendering(loader.item));
    }
    function init() {
        sessions.clear();
        users.lastUser = "demo";
        keys.capsLock = false;
    }
    function cleanup() {
        loader.active = false;
    }

    function test_failedLoginCanBeRetried() {
        sessions.append({name: "Hyprland"});
        loadTheme();
        const username = field("usernameField");
        const password = field("passwordField");
        const session = field("sessionSelector");
        const login = field("loginButton");
        const status = field("statusMessage");
        username.forceActiveFocus();
        keyClick(Qt.Key_A, Qt.ControlModifier);
        typeText("test-account");
        keyClick(Qt.Key_Tab);
        tryCompare(password, "activeFocus", true);
        typeText("synthetic-secret");
        keyClick(Qt.Key_Return);
        compare(loader.item.authenticating, true);
        compare(username.enabled, false);
        compare(password.enabled, false);
        compare(session.enabled, false);
        compare(login.enabled, false);
        compare(status.text, "Anmeldung läuft …");

        backend.loginFailed();
        compare(loader.item.authenticating, false);
        compare(password.text, "");
        compare(status.text, "Anmeldung fehlgeschlagen. Bitte erneut versuchen.");
        compare(status.visible, true);
        tryCompare(password, "activeFocus", true);
        compare(password.enabled, true);
        typeText("another-synthetic-secret");
        compare(password.text, "another-synthetic-secret");
        keyClick(Qt.Key_Return);
        compare(loader.item.authenticating, true);
        compare(password.enabled, false);
        compare(status.text, "Anmeldung läuft …");
    }

    function test_missingSessionRecovers() {
        loadTheme();
        const password = field("passwordField");
        const session = field("sessionSelector");
        const login = field("loginButton");
        const status = field("statusMessage");
        compare(session.currentIndex, -1);
        compare(status.text, "Keine Sitzung verfügbar.");
        compare(status.visible, true);
        compare(login.enabled, false);
        password.forceActiveFocus();
        typeText("synthetic-secret");
        keyClick(Qt.Key_Return);
        compare(loader.item.authenticating, false);
        compare(password.enabled, true);

        sessions.append({name: "Hyprland"});
        tryCompare(session, "currentIndex", 0);
        tryCompare(login, "enabled", true);
        compare(status.text, "");
        compare(status.visible, false);
        password.forceActiveFocus();
        keyClick(Qt.Key_Return);
        compare(loader.item.authenticating, true);
        compare(status.text, "Anmeldung läuft …");
    }
}
