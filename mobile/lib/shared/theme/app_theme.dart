import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Couleurs de la marque Voyaj
class VoyajColors {
  // Couleur principale : violet/indigo profond
  static const primary = Color(0xFF4F46E5);
  static const primaryContainer = Color(0xFFE0E7FF);
  static const onPrimary = Color(0xFFFFFFFF);
  static const onPrimaryContainer = Color(0xFF1E1B4B);

  // Secondaire : orange chaleureux
  static const secondary = Color(0xFFF97316);
  static const secondaryContainer = Color(0xFFFFEDD5);
  static const onSecondary = Color(0xFFFFFFFF);
  static const onSecondaryContainer = Color(0xFF431407);

  // Tertiaire : vert succès
  static const tertiary = Color(0xFF16A34A);
  static const tertiaryContainer = Color(0xFFDCFCE7);

  // Erreur
  static const error = Color(0xFFDC2626);
  static const errorContainer = Color(0xFFFEE2E2);

  // Surfaces
  static const surfaceDark = Color(0xFF1A1A2E);
  static const surfaceVariantDark = Color(0xFF252547);

  // Textes
  static const textMuted = Color(0xFF6B7280);
  static const divider = Color(0xFFE5E7EB);

  // États de course
  static const rideSearching = Color(0xFF4F46E5);
  static const rideActive = Color(0xFF16A34A);
  static const rideCompleted = Color(0xFF6B7280);
  static const rideCancelled = Color(0xFFDC2626);
  static const rideDispute = Color(0xFFF97316);
}

class AppTheme {
  static ThemeData light() {
    final colorScheme = ColorScheme(
      brightness: Brightness.light,
      primary: VoyajColors.primary,
      onPrimary: VoyajColors.onPrimary,
      primaryContainer: VoyajColors.primaryContainer,
      onPrimaryContainer: VoyajColors.onPrimaryContainer,
      secondary: VoyajColors.secondary,
      onSecondary: VoyajColors.onSecondary,
      secondaryContainer: VoyajColors.secondaryContainer,
      onSecondaryContainer: VoyajColors.onSecondaryContainer,
      tertiary: VoyajColors.tertiary,
      onTertiary: Colors.white,
      tertiaryContainer: VoyajColors.tertiaryContainer,
      onTertiaryContainer: const Color(0xFF052E16),
      error: VoyajColors.error,
      onError: Colors.white,
      errorContainer: VoyajColors.errorContainer,
      onErrorContainer: const Color(0xFF7F1D1D),
      surface: const Color(0xFFFFFFFF),
      onSurface: const Color(0xFF111827),
      surfaceContainerHighest: const Color(0xFFF3F4F6),
      onSurfaceVariant: const Color(0xFF374151),
      outline: const Color(0xFFD1D5DB),
      shadow: Colors.black,
      inverseSurface: const Color(0xFF1F2937),
      onInverseSurface: const Color(0xFFF9FAFB),
      inversePrimary: const Color(0xFF818CF8),
      scrim: Colors.black,
    );

    return _buildTheme(colorScheme, Brightness.light);
  }

  static ThemeData dark() {
    final colorScheme = ColorScheme(
      brightness: Brightness.dark,
      primary: const Color(0xFF818CF8),
      onPrimary: const Color(0xFF1E1B4B),
      primaryContainer: const Color(0xFF312E81),
      onPrimaryContainer: const Color(0xFFE0E7FF),
      secondary: const Color(0xFFFB923C),
      onSecondary: const Color(0xFF431407),
      secondaryContainer: const Color(0xFF7C2D12),
      onSecondaryContainer: const Color(0xFFFFEDD5),
      tertiary: const Color(0xFF4ADE80),
      onTertiary: const Color(0xFF052E16),
      tertiaryContainer: const Color(0xFF14532D),
      onTertiaryContainer: const Color(0xFFDCFCE7),
      error: const Color(0xFFF87171),
      onError: const Color(0xFF7F1D1D),
      errorContainer: const Color(0xFF991B1B),
      onErrorContainer: const Color(0xFFFEE2E2),
      surface: VoyajColors.surfaceDark,
      onSurface: const Color(0xFFF9FAFB),
      surfaceContainerHighest: VoyajColors.surfaceVariantDark,
      onSurfaceVariant: const Color(0xFFD1D5DB),
      outline: const Color(0xFF4B5563),
      shadow: Colors.black,
      inverseSurface: const Color(0xFFF3F4F6),
      onInverseSurface: const Color(0xFF111827),
      inversePrimary: VoyajColors.primary,
      scrim: Colors.black,
    );

    return _buildTheme(colorScheme, Brightness.dark);
  }

  static ThemeData _buildTheme(ColorScheme cs, Brightness brightness) {
    final isLight = brightness == Brightness.light;

    return ThemeData(
      useMaterial3: true,
      colorScheme: cs,
      fontFamily: 'Inter',

      // AppBar
      appBarTheme: AppBarTheme(
        elevation: 0,
        scrolledUnderElevation: 1,
        centerTitle: true,
        backgroundColor: cs.surface,
        foregroundColor: cs.onSurface,
        systemOverlayStyle: isLight
            ? SystemUiOverlayStyle.dark
            : SystemUiOverlayStyle.light,
      ),

      // NavigationBar (barre du bas)
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: cs.surface,
        indicatorColor: cs.primaryContainer,
        labelTextStyle: WidgetStateProperty.all(
          const TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
        ),
      ),

      // Cartes
      cardTheme: CardTheme(
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: cs.outline, width: 1),
        ),
        color: cs.surface,
        margin: EdgeInsets.zero,
      ),

      // Boutons principaux
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(52),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
            fontFamily: 'Inter',
          ),
        ),
      ),

      // Boutons outlined
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(52),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
            fontFamily: 'Inter',
          ),
        ),
      ),

      // Champs de texte
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: isLight
            ? const Color(0xFFF9FAFB)
            : VoyajColors.surfaceVariantDark,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: cs.outline),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: cs.outline),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: cs.primary, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: cs.error),
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 14,
        ),
      ),

      // Bottom sheet
      bottomSheetTheme: BottomSheetThemeData(
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        backgroundColor: cs.surface,
        elevation: 8,
      ),

      // Chip
      chipTheme: ChipThemeData(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
        ),
      ),

      // Switch
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) return cs.primary;
          return null;
        }),
        trackColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return cs.primaryContainer;
          }
          return null;
        }),
      ),

      // Divider
      dividerTheme: DividerThemeData(
        color: cs.outline,
        thickness: 1,
        space: 1,
      ),

      // Texte
      textTheme: _textTheme(cs),

      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          TargetPlatform.android: PredictiveBackPageTransitionsBuilder(),
          TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
        },
      ),
    );
  }

  static TextTheme _textTheme(ColorScheme cs) {
    return TextTheme(
      displayLarge: TextStyle(
        fontSize: 57,
        fontWeight: FontWeight.w700,
        color: cs.onSurface,
        fontFamily: 'Inter',
      ),
      headlineLarge: TextStyle(
        fontSize: 32,
        fontWeight: FontWeight.w700,
        color: cs.onSurface,
        fontFamily: 'Inter',
      ),
      headlineMedium: TextStyle(
        fontSize: 28,
        fontWeight: FontWeight.w600,
        color: cs.onSurface,
        fontFamily: 'Inter',
      ),
      headlineSmall: TextStyle(
        fontSize: 24,
        fontWeight: FontWeight.w600,
        color: cs.onSurface,
        fontFamily: 'Inter',
      ),
      titleLarge: TextStyle(
        fontSize: 20,
        fontWeight: FontWeight.w600,
        color: cs.onSurface,
        fontFamily: 'Inter',
      ),
      titleMedium: TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.w500,
        color: cs.onSurface,
        fontFamily: 'Inter',
      ),
      titleSmall: TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w500,
        color: cs.onSurface,
        fontFamily: 'Inter',
      ),
      bodyLarge: TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.w400,
        color: cs.onSurface,
        fontFamily: 'Inter',
      ),
      bodyMedium: TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w400,
        color: cs.onSurface,
        fontFamily: 'Inter',
      ),
      bodySmall: TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w400,
        color: cs.onSurfaceVariant,
        fontFamily: 'Inter',
      ),
      labelLarge: TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w600,
        color: cs.onSurface,
        fontFamily: 'Inter',
      ),
      labelSmall: TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w500,
        color: cs.onSurfaceVariant,
        fontFamily: 'Inter',
        letterSpacing: 0.5,
      ),
    );
  }
}
