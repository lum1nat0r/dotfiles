import QtQuick
import QtQuick.Layouts
import QtQuick.Controls.Basic as Controls

Rectangle {
    id: root
    color: "#10151f"

    readonly property color foreground: "#ffffff"
    readonly property color muted: "#e0e5e8"
    readonly property color accent: "#d7ecff"
    readonly property color errorColor: "#ffd1d1"
    readonly property color glass: Qt.rgba(25/255, 35/255, 43/255, 0.96)
    readonly property color outline: Qt.rgba(1, 1, 1, 0.20)
    readonly property color fieldFill: Qt.rgba(1, 1, 1, 0.18)
    readonly property string typeface: "sans-serif"
    property bool authenticating: false
    property string message: ""
    property bool loginError: false
    property date now: new Date()
    readonly property bool validSession: session.currentIndex >= 0 && session.currentIndex < session.count


    Text {
        anchors.top: parent.top
        anchors.right: parent.right
        anchors.topMargin: 18
        anchors.rightMargin: 24
        text: Qt.formatTime(root.now, "HH:mm")
        color: root.foreground
        font.family: root.typeface
        font.pixelSize: 13
    }

    function submitLogin() {
        if (authenticating || username.text.length === 0 || !validSession)
            return;
        message = "";
        loginError = false;
        authenticating = true;
        sddm.login(username.text, password.text, session.currentIndex);
    }

    function reveal(control) {
        if (!control.activeFocus)
            return;
        const top = control.mapToItem(viewport.contentItem, 0, 0).y;
        if (top < viewport.contentY + 8)
            viewport.contentY = Math.max(0, top - 8);
        else if (top + control.height > viewport.contentY + viewport.height - 8)
            viewport.contentY = Math.min(viewport.contentHeight - viewport.height,
                                        top + control.height - viewport.height + 8);
    }

    Timer {
        interval: 1000
        running: true
        repeat: true
        onTriggered: root.now = new Date()
    }

    Connections {
        target: sddm
        function onLoginFailed() {
            root.authenticating = false;
            password.clear();
            root.loginError = true;
            root.message = "Anmeldung fehlgeschlagen. Bitte erneut versuchen.";
            password.forceActiveFocus();
        }
        function onLoginSucceeded() {
            password.clear();
            root.authenticating = true;
        }
        function onInformationMessage(message) {
            root.message = message;
        }
    }

    component Label: Text {
        color: root.foreground
        font.family: root.typeface
        font.pixelSize: 14
        textFormat: Text.PlainText
        wrapMode: Text.Wrap
        Layout.fillWidth: true
    }

    component Field: Controls.TextField {
        Layout.fillWidth: true
        implicitHeight: 36
        font.family: root.typeface
        font.pixelSize: 14
        color: root.foreground
        placeholderTextColor: root.muted
        selectionColor: root.accent
        selectedTextColor: root.color
        leftPadding: 14
        rightPadding: 14
        selectByMouse: true
        enabled: !root.authenticating
        onActiveFocusChanged: root.reveal(this)
        onAccepted: root.submitLogin()
        background: Rectangle {
            radius: 5
            color: root.fieldFill
            border.color: parent.activeFocus ? root.accent : root.outline
            border.width: parent.activeFocus ? 2 : 1
        }
    }

    component HoverLight: Rectangle {
        property bool active: false
        property real progress: active ? 1 : 0
        anchors.centerIn: parent
        anchors.alignWhenCentered: false
        width: parent.width * progress
        height: parent.height * progress
        radius: parent.radius * progress
        opacity: progress
        gradient: Gradient {
            GradientStop { position: 0; color: Qt.rgba(0.80, 0.90, 1, 0.24) }
            GradientStop { position: 0.55; color: Qt.rgba(0.65, 0.78, 1, 0.12) }
            GradientStop { position: 1; color: Qt.rgba(0.65, 0.78, 1, 0.04) }
        }
        Behavior on progress {
            NumberAnimation { duration: 420; easing.type: Easing.OutCubic }
        }
    }

    component GlassButton: Controls.Button {
        id: button
        implicitHeight: 36
        font.family: root.typeface
        font.pixelSize: 14
        leftPadding: 12
        rightPadding: 12
        enabled: !root.authenticating
        hoverEnabled: true
        onActiveFocusChanged: root.reveal(this)
        contentItem: Text {
            text: button.text
            font: button.font
            color: root.foreground
            opacity: button.enabled ? 1 : 0.5
            horizontalAlignment: Text.AlignHCenter
            verticalAlignment: Text.AlignVCenter
            textFormat: Text.PlainText
        }
        background: Rectangle {
            radius: height / 2
            color: Qt.rgba(1, 1, 1,
                           button.down ? 0.32 : button.visualFocus ? 0.24 : 0.10)
            border.color: button.visualFocus ? root.accent : "transparent"
            border.width: button.visualFocus ? 2 : 0
            Behavior on color { ColorAnimation { duration: 120 } }
            HoverLight { active: button.enabled && button.hovered }
        }
    }

    component PowerButton: Controls.Button {
        id: powerButton
        property bool restart: false
        implicitWidth: 120
        implicitHeight: 74
        enabled: !root.authenticating
        hoverEnabled: true
        onActiveFocusChanged: root.reveal(this)
        contentItem: Column {
            spacing: 9
            opacity: powerButton.enabled ? 1 : 0.5
            Canvas {
                width: 32
                height: 32
                anchors.horizontalCenter: parent.horizontalCenter
                onPaint: {
                    const ctx = getContext("2d");
                    ctx.reset();
                    ctx.strokeStyle = root.foreground;
                    ctx.fillStyle = root.foreground;
                    ctx.lineWidth = 1.4;
                    ctx.lineCap = "round";
                    ctx.beginPath();
                    if (powerButton.restart) {
                        ctx.arc(16, 16, 13, 0, Math.PI * 2);
                        ctx.stroke();
                        ctx.beginPath();
                        ctx.arc(16, 16, 7, -0.6, Math.PI * 1.5);
                        ctx.stroke();
                        ctx.beginPath();
                        ctx.moveTo(16, 6);
                        ctx.lineTo(20, 9);
                        ctx.lineTo(16, 12);
                        ctx.fill();
                    } else {
                        ctx.arc(16, 16, 12, -Math.PI / 2 + 0.55, Math.PI * 1.5 - 0.55);
                        ctx.stroke();
                        ctx.beginPath();
                        ctx.moveTo(16, 2);
                        ctx.lineTo(16, 15);
                        ctx.stroke();
                    }
                }
            }
            Text {
                width: parent.width
                text: powerButton.text
                color: root.foreground
                font.family: root.typeface
                font.pixelSize: 12
                textFormat: Text.PlainText
                horizontalAlignment: Text.AlignHCenter
            }
        }
        background: Rectangle {
            radius: 8
            color: powerButton.down ? Qt.rgba(1, 1, 1, 0.20) : "transparent"
            border.color: powerButton.visualFocus ? root.accent : "transparent"
            border.width: powerButton.visualFocus ? 2 : 0
            Behavior on color { ColorAnimation { duration: 220 } }
            HoverLight { active: powerButton.enabled && powerButton.hovered }
        }
    }

    component Selector: Controls.ComboBox {
        id: selector
        Layout.fillWidth: true
        implicitHeight: 32
        font.family: root.typeface
        font.pixelSize: 14
        enabled: !root.authenticating && count > 0
        leftPadding: 14
        rightPadding: 36
        onActiveFocusChanged: root.reveal(this)
        contentItem: Text {
            text: selector.displayText
            font: selector.font
            color: root.foreground
            opacity: selector.enabled ? 1 : 0.5
            verticalAlignment: Text.AlignVCenter
            elide: Text.ElideRight
            textFormat: Text.PlainText
        }
        indicator: Text {
            x: selector.width - width - 14
            anchors.verticalCenter: parent.verticalCenter
            text: "⌄"
            color: root.muted
            font.pixelSize: 18
        }
        background: Rectangle {
            radius: 5
            color: root.fieldFill
            border.color: selector.visualFocus ? root.accent : root.outline
            border.width: selector.visualFocus ? 2 : 1
        }
        delegate: Controls.ItemDelegate {
            required property int index
            required property var model
            width: selector.width - 12
            implicitHeight: 48
            highlighted: selector.highlightedIndex === index
            contentItem: Text {
                text: model[selector.textRole]
                color: root.foreground
                font: selector.font
                verticalAlignment: Text.AlignVCenter
                elide: Text.ElideRight
                textFormat: Text.PlainText
            }
            background: Rectangle {
                radius: 8
                color: parent.highlighted ? Qt.rgba(165/255, 200/255, 1, 0.30) : "transparent"
            }
        }
        popup: Controls.Popup {
            parent: Controls.Overlay.overlay
            x: selector.mapToItem(parent, 0, 0).x
            y: Math.max(16, Math.min(selector.mapToItem(parent, 0, selector.height + 4).y,
                                     root.height - height - 16))
            width: selector.width
            height: Math.min(contentItem.implicitHeight + 12, root.height - 32)
            padding: 6
            contentItem: ListView {
                clip: true
                implicitHeight: contentHeight
                model: selector.popup.visible ? selector.delegateModel : null
                currentIndex: selector.highlightedIndex
                highlightMoveDuration: 0
                Controls.ScrollIndicator.vertical: Controls.ScrollIndicator { }
            }
            background: Rectangle {
                color: root.glass
                radius: 14
                border.color: root.outline
            }
        }
    }

    Flickable {
        id: viewport
        anchors.fill: parent
        anchors.margins: 16
        contentWidth: width
        contentHeight: Math.max(height, form.implicitHeight + footer.implicitHeight + 110)
        clip: true
        boundsBehavior: Flickable.StopAtBounds
        Controls.ScrollBar.vertical: Controls.ScrollBar { }

        ColumnLayout {
            id: form
            width: Math.min(360, viewport.width)
            x: (viewport.width - width) / 2
            y: Math.max(24, Math.min(viewport.height * 0.32, footer.y - height - 36))
            spacing: 14

            Label {
                text: "Username"
                font.pixelSize: 11
                Layout.fillWidth: false
                Layout.preferredWidth: Math.min(300, form.width)
                Layout.alignment: Qt.AlignHCenter
            }
            Field {
                id: username
                objectName: "usernameField"
                Layout.fillWidth: false
                Layout.preferredWidth: Math.min(300, form.width)
                Layout.alignment: Qt.AlignHCenter
                text: userModel.lastUser
                placeholderText: "Benutzername"
                horizontalAlignment: TextInput.AlignLeft
                font.pixelSize: 14
                Accessible.name: "Benutzername"
                KeyNavigation.tab: password
                KeyNavigation.backtab: shutdown.visible ? shutdown : reboot.visible ? reboot : login
            }
            Label {
                text: "Password"
                font.pixelSize: 11
                Layout.fillWidth: false
                Layout.preferredWidth: Math.min(300, form.width)
                Layout.alignment: Qt.AlignHCenter
            }
            RowLayout {
                Layout.preferredWidth: Math.min(300, form.width)
                Layout.fillWidth: false
                Layout.maximumWidth: Math.min(300, form.width)
                Layout.alignment: Qt.AlignHCenter
                spacing: 10
                Field {
                    id: password
                    objectName: "passwordField"
                    placeholderText: "Passwort eingeben …"
                    echoMode: TextInput.Password
                    Accessible.name: "Passwort"
                    KeyNavigation.tab: session
                    KeyNavigation.backtab: username
                }
                GlassButton {
                    id: login
                    objectName: "loginButton"
                    Layout.preferredWidth: 36
                    text: "→"
                    font.pixelSize: 23
                    leftPadding: 0
                    rightPadding: 0
                    Accessible.name: "Anmelden"
                    Controls.ToolTip.visible: hovered
                    Controls.ToolTip.text: "Anmelden"
                    enabled: !root.authenticating && username.text.length > 0 && root.validSession
                    onClicked: root.submitLogin()
                    KeyNavigation.tab: reboot.visible ? reboot : shutdown.visible ? shutdown : username
                    KeyNavigation.backtab: layout.visible ? layout : session
                }
            }
            Label {
                text: "Feststelltaste aktiv"
                color: root.accent
                visible: keyboard.capsLock
                horizontalAlignment: Text.AlignHCenter
            }
            Label {
                objectName: "statusMessage"
                text: session.count === 0 ? "Keine Sitzung verfügbar."
                      : root.message.length > 0 ? root.message
                      : root.authenticating ? "Anmeldung läuft …" : ""
                visible: text.length > 0
                color: root.loginError || session.count === 0 ? root.errorColor : root.muted
                horizontalAlignment: Text.AlignHCenter
                Accessible.role: Accessible.AlertMessage
            }
        }

        ColumnLayout {
            id: footer
            width: viewport.width
            y: viewport.contentHeight - height
            spacing: 16

            RowLayout {
                Layout.alignment: Qt.AlignHCenter
                spacing: 16
                visible: sddm.canPowerOff || sddm.canReboot
                PowerButton {
                    id: reboot
                    restart: true
                    visible: sddm.canReboot
                    enabled: visible && !root.authenticating
                    text: "Neustarten"
                    onClicked: sddm.reboot()
                    KeyNavigation.tab: shutdown.visible ? shutdown : username
                    KeyNavigation.backtab: login
                }
                PowerButton {
                    id: shutdown
                    visible: sddm.canPowerOff
                    enabled: visible && !root.authenticating
                    text: "Herunterfahren"
                    onClicked: sddm.powerOff()
                    KeyNavigation.tab: username
                    KeyNavigation.backtab: reboot.visible ? reboot : login
                }
            }
            RowLayout {
                Layout.alignment: Qt.AlignRight
                Layout.preferredWidth: Math.min(340, viewport.width)
                Layout.maximumWidth: Math.min(340, viewport.width)
                spacing: 8
                ColumnLayout {
                    Layout.fillWidth: true
                    spacing: 5
                    Label { text: "Sitzung"; font.pixelSize: 11; horizontalAlignment: Text.AlignHCenter }
                    Selector {
                        id: session
                        objectName: "sessionSelector"
                        implicitHeight: 26
                        font.pixelSize: 11
                        model: sessionModel
                        textRole: "name"
                        Accessible.name: "Sitzung"
                        property bool initialized: false
                        Component.onCompleted: {
                            currentIndex = sessionModel.lastIndex >= 0 && sessionModel.lastIndex < count
                                         ? sessionModel.lastIndex : count > 0 ? 0 : -1;
                            initialized = true;
                        }
                        onCountChanged: {
                            if (initialized && (currentIndex < 0 || currentIndex >= count))
                                currentIndex = count > 0 ? 0 : -1;
                        }
                        KeyNavigation.tab: layout.visible ? layout : login
                        KeyNavigation.backtab: password
                    }
                }
                ColumnLayout {
                    Layout.preferredWidth: 90
                    Layout.minimumWidth: 90
                    Layout.maximumWidth: 90
                    spacing: 5
                    visible: keyboard.enabled && layout.count > 0
                    Label { text: "Tastaturlayout"; font.pixelSize: 11; horizontalAlignment: Text.AlignHCenter }
                    Selector {
                        id: layout
                        objectName: "layoutSelector"
                        implicitHeight: 26
                        font.pixelSize: 11
                        model: keyboard.layouts
                        textRole: "shortName"
                        currentIndex: keyboard.currentLayout
                        Accessible.name: "Tastaturlayout"
                        onActivated: function(index) { keyboard.currentLayout = index; }
                        KeyNavigation.tab: login
                        KeyNavigation.backtab: session
                    }
                }
            }
        }
    }

    Component.onCompleted: {
        if (username.text.length > 0)
            password.forceActiveFocus();
        else
            username.forceActiveFocus();
    }
}
