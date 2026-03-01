package com.wifisentry.core

import com.google.gson.annotations.SerializedName

/**
 * A cross-platform UI schema that allows the backend or a local JSON file
 * to define UI elements for both the Web Dashboard and the Android App.
 */
data class UiComponent(
    @SerializedName("type") val type: String, // "button", "card", "text", "container", "switch", "progress", "divider", "icon", "input", "list"
    @SerializedName("label") val label: String? = null,
    @SerializedName("value") val value: String? = null,
    @SerializedName("placeholder") val placeholder: String? = null,
    @SerializedName("icon") val icon: String? = null, // "shield", "wifi", "alert", "check", "edit", "search"
    @SerializedName("isChecked") val isChecked: Boolean? = null,
    @SerializedName("style") val style: Map<String, String>? = null, // Tailwind classes or raw properties
    @SerializedName("children") val children: List<UiComponent>? = null,
    @SerializedName("action") val action: String? = null // "scan", "navigate", "toggle_monitor", "submit_input"
)

data class UiScreen(
    @SerializedName("id") val id: String,
    @SerializedName("title") val title: String,
    @SerializedName("root") val root: UiComponent
)

object UiSchemaManager {
    /**
     * Professional-grade security dashboard with Input and Dynamic List.
     */
    fun getDefaultDashboard(): UiScreen {
        return UiScreen(
            id = "dashboard",
            title = "Threat Analysis Center",
            root = UiComponent(
                type = "container",
                style = mapOf("padding" to "16", "background" to "bg-gray-950"),
                children = listOf(
                    // Search/Filter Input
                    UiComponent(
                        type = "container",
                        style = mapOf("marginBottom" to "20", "padding" to "12", "background" to "bg-gray-900"),
                        children = listOf(
                            UiComponent(
                                type = "input",
                                label = "SSID Filter",
                                placeholder = "Search for networks...",
                                icon = "search",
                                action = "submit_input"
                            )
                        )
                    ),

                    // Quick Stats Cards (Horizontal)
                    UiComponent(
                        type = "container",
                        style = mapOf("orientation" to "horizontal", "marginBottom" to "20"),
                        children = listOf(
                            UiComponent(
                                type = "card",
                                label = "Scanning",
                                value = "12/48 APs",
                                style = mapOf("flex" to "1", "marginRight" to "8")
                            ),
                            UiComponent(
                                type = "card",
                                label = "Alerts",
                                value = "3 Active",
                                icon = "alert",
                                style = mapOf("flex" to "1", "marginLeft" to "8", "color" to "text-red-400")
                            )
                        )
                    ),

                    // Dynamic List Header
                    UiComponent(
                        type = "text",
                        value = "Recent Threats Detected",
                        style = mapOf("fontSize" to "lg", "fontWeight" to "bold", "marginBottom" to "12")
                    ),

                    // Dynamic List of Items (Represented as a list type)
                    UiComponent(
                        type = "list",
                        children = listOf(
                            UiComponent(
                                type = "card",
                                label = "BSSID: AC:D7:5B:A1:8F:96",
                                value = "Evil Twin Suspected",
                                icon = "alert",
                                style = mapOf("background" to "bg-gray-800", "marginBottom" to "8")
                            ),
                            UiComponent(
                                type = "card",
                                label = "BSSID: E4:BF:FA:42:11:00",
                                value = "Karma Attack Signature",
                                icon = "alert",
                                style = mapOf("background" to "bg-gray-800", "marginBottom" to "8")
                            ),
                            UiComponent(
                                type = "card",
                                label = "BSSID: 00:25:9C:CF:1B:EF",
                                value = "Strong Signal Anomaly",
                                icon = "alert",
                                style = mapOf("background" to "bg-gray-800")
                            )
                        )
                    ),

                    // Action Button
                    UiComponent(
                        type = "button",
                        label = "Clear Threat Logs",
                        action = "clear_logs",
                        style = mapOf("marginTop" to "32", "background" to "bg-gray-800")
                    )
                )
            )
        )
    }
}
