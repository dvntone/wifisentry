package com.wifisentry.app

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.appcompat.widget.SwitchCompat
import androidx.core.content.ContextCompat
import com.google.android.material.button.MaterialButton
import com.google.android.material.card.MaterialCardView
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.textfield.TextInputLayout
import com.wifisentry.core.UiComponent

/**
 * Transforms a cross-platform UiComponent schema into native Android Views.
 * Enhanced with Input fields, dynamic Lists, and Flexible layouts.
 */
class DynamicUiRenderer(private val context: Context) {

    fun render(component: UiComponent, parent: ViewGroup? = null): View {
        val view = when (component.type) {
            "container" -> createContainer(component)
            "text" -> createTextView(component)
            "button" -> createButton(component)
            "card" -> createCard(component)
            "switch" -> createSwitch(component)
            "progress" -> createProgressBar(component)
            "divider" -> createDivider(component)
            "icon" -> createIconView(component)
            "input" -> createInput(component)
            "list" -> createContainer(component) // For simple lists, a container is sufficient
            else -> createTextView(component.copy(value = "Unknown: ${component.type}"))
        }

        applyStyle(view, component.style ?: emptyMap())
        parent?.addView(view)
        
        // Render children
        if (view is ViewGroup && component.children != null) {
            for (child in component.children!!) {
                render(child, view)
            }
        }

        return view
    }

    private fun createContainer(component: UiComponent): LinearLayout {
        return LinearLayout(context).apply {
            orientation = if (component.style?.get("orientation") == "horizontal") 
                LinearLayout.HORIZONTAL else LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
            if (orientation == LinearLayout.HORIZONTAL) {
                gravity = Gravity.CENTER_VERTICAL
            }
        }
    }

    private fun createTextView(component: UiComponent): TextView {
        return TextView(context).apply {
            text = component.value ?: ""
            setTextColor(Color.WHITE)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        }
    }

    private fun createButton(component: UiComponent): MaterialButton {
        return MaterialButton(context).apply {
            text = component.label ?: "Button"
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        }
    }

    private fun createInput(component: UiComponent): View {
        val textInputLayout = TextInputLayout(context).apply {
            hint = component.label
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
            boxBackgroundMode = TextInputLayout.BOX_BACKGROUND_OUTLINE
            setBoxStrokeColor(Color.parseColor("#3b82f6")) // blue-500
        }

        val editText = TextInputEditText(context).apply {
            hint = component.placeholder
            setTextColor(Color.WHITE)
            setHintTextColor(Color.GRAY)
        }

        textInputLayout.addView(editText)
        return textInputLayout
    }

    private fun createSwitch(component: UiComponent): View {
        return SwitchCompat(context).apply {
            text = component.label
            isChecked = component.isChecked ?: false
            setTextColor(Color.WHITE)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        }
    }

    private fun createProgressBar(component: UiComponent): ProgressBar {
        return ProgressBar(context, null, android.R.attr.progressBarStyleHorizontal).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
            progress = component.value?.toIntOrNull() ?: 0
            max = 100
        }
    }

    private fun createDivider(component: UiComponent): View {
        return View(context).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                2
            )
            setBackgroundColor(Color.parseColor("#374151")) // bg-gray-700
        }
    }

    private fun createIconView(component: UiComponent): TextView {
        return TextView(context).apply {
            text = when (component.icon) {
                "shield" -> "🛡️"
                "check" -> "✅"
                "alert" -> "⚠️"
                "wifi" -> "📶"
                "search" -> "🔍"
                "edit" -> "📝"
                else -> "•"
            }
            textSize = 24f
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        }
    }

    private fun createCard(component: UiComponent): MaterialCardView {
        val card = MaterialCardView(context).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
            radius = 24f
            cardElevation = 4f
            setCardBackgroundColor(Color.parseColor("#1f2937")) // bg-gray-800
        }
        
        val inner = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(32, 32, 32, 32)
        }
        
        if (component.icon != null) {
            inner.addView(createIconView(component).apply {
                textSize = 28f
                setPadding(0, 0, 24, 0)
            })
        }

        val textStack = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
        }
        
        if (component.label != null) {
            textStack.addView(TextView(context).apply {
                text = component.label
                setTextColor(Color.GRAY)
                textSize = 12f
            })
        }
        
        if (component.value != null) {
            textStack.addView(TextView(context).apply {
                text = component.value
                setTextColor(Color.WHITE)
                textSize = 18f
                setTypeface(null, Typeface.BOLD)
            })
        }
        
        inner.addView(textStack)
        card.addView(inner)
        return card
    }

    private fun applyStyle(view: View, style: Map<String, String>) {
        val lp = view.layoutParams as? LinearLayout.LayoutParams ?: return

        style.forEach { (key, value) ->
            when (key) {
                "flex" -> lp.weight = value.toFloatOrNull() ?: 0f
                "padding" -> {
                    val p = (value.toIntOrNull() ?: 0) * 2
                    view.setPadding(p, p, p, p)
                }
                "marginTop" -> lp.topMargin = (value.toIntOrNull() ?: 0) * 2
                "marginBottom" -> lp.bottomMargin = (value.toIntOrNull() ?: 0) * 2
                "marginLeft" -> lp.leftMargin = (value.toIntOrNull() ?: 0) * 2
                "marginRight" -> lp.rightMargin = (value.toIntOrNull() ?: 0) * 2
                "fontSize" -> if (view is TextView) {
                    view.textSize = when(value) {
                        "xl" -> 22f
                        "lg" -> 18f
                        "sm" -> 12f
                        else -> 16f
                    }
                }
                "fontWeight" -> if (view is TextView && value == "bold") {
                    view.setTypeface(null, Typeface.BOLD)
                }
                "color" -> if (view is TextView) {
                    when (value) {
                        "text-blue-400" -> view.setTextColor(Color.parseColor("#60a5fa"))
                        "text-red-400" -> view.setTextColor(Color.parseColor("#f87171"))
                        "text-gray-400" -> view.setTextColor(Color.GRAY)
                    }
                }
                "background" -> {
                    when (value) {
                        "bg-blue-600" -> view.setBackgroundColor(Color.parseColor("#2563eb"))
                        "bg-gray-900" -> view.setBackgroundColor(Color.parseColor("#1f2937"))
                        "bg-gray-950" -> view.setBackgroundColor(Color.parseColor("#030712"))
                        "bg-gray-800" -> view.setBackgroundColor(Color.parseColor("#1f2937"))
                    }
                }
            }
        }
    }
}
