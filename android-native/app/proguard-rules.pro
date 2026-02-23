# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified in the Android SDK.
# For more details, see http://developer.android.com/guide/developing/tools/proguard.html

# Keep Gson model classes
-keepattributes Signature
-keepattributes *Annotation*
-dontwarn sun.misc.**
-keep class com.google.gson.** { *; }
-keep class * implements com.google.gson.TypeAdapterFactory
-keep class * implements com.google.gson.JsonSerializer
-keep class * implements com.google.gson.JsonDeserializer
