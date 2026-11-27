plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val withWhisper = project.hasProperty("withWhisper") && file("src/main/cpp/whisper.cpp/CMakeLists.txt").exists()

android {
    namespace = "com.astracore.astraplayer"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.astracore.astraplayer"
        minSdk = 24
        targetSdk = 34
        versionCode = 2146
        versionName = "2.10.46"
        ndk { abiFilters += listOf("arm64-v8a", "armeabi-v7a") }
    }

    signingConfigs {
        create("astra") {
            storeFile = file("astra.jks")
            storePassword = "astra-player-w40mYrpeHK5HuP"
            keyAlias = "astraplayer"
            keyPassword = "astra-player-w40mYrpeHK5HuP"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            // Signed with the debug key so the APK installs directly (sideloading).
            signingConfig = signingConfigs.getByName("astra")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    if (withWhisper) {
        externalNativeBuild { cmake { path = file("src/main/cpp/CMakeLists.txt") } }
    }
    lint {
        checkReleaseBuilds = false
        abortOnError = false
    }
    packaging { jniLibs { useLegacyPackaging = true } }
    // The web UI lives in ../public and is copied into the app at build time (one source of truth).
    sourceSets.getByName("main").assets.srcDir(layout.buildDirectory.dir("generated/webassets"))
}

kotlin {
    compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) }
}

val copyWeb by tasks.registering(Copy::class) {
    from("../../public")
    into(layout.buildDirectory.dir("generated/webassets/www"))
}
tasks.matching { it.name.startsWith("merge") && it.name.endsWith("Assets") }.configureEach { dependsOn(copyWeb) }

dependencies {
    val media3 = "1.11.1"
    implementation("androidx.media3:media3-exoplayer:$media3")
    implementation("androidx.media3:media3-ui:$media3")
    implementation("androidx.media3:media3-inspector:$media3")
    implementation("io.github.anilbeesetti:nextlib-media3ext:1.11.1-0.19.0") // FFmpeg software decoders for Media3
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("net.java.dev.jna:jna:5.13.0@aar")
    implementation("com.alphacephei:vosk-android:0.3.47")
}
