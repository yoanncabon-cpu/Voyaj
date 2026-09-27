import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:pinput/pinput.dart';

import '../../../../shared/constants/app_constants.dart';
import '../../../../shared/theme/app_theme.dart';

class AuthOtpScreen extends StatefulWidget {
  const AuthOtpScreen({super.key, required this.extra});

  final Map<String, dynamic> extra;

  @override
  State<AuthOtpScreen> createState() => _AuthOtpScreenState();
}

class _AuthOtpScreenState extends State<AuthOtpScreen> {
  final _pinController = TextEditingController();
  bool _loading = false;
  String? _error;

  String get _verificationId => widget.extra['verificationId'] as String? ?? '';
  String get _phone => widget.extra['phone'] as String? ?? '';

  Future<void> _verify(String code) async {
    if (code.length != 6) return;
    setState(() { _loading = true; _error = null; });

    try {
      final credential = PhoneAuthProvider.credential(
        verificationId: _verificationId,
        smsCode: code,
      );
      final result = await FirebaseAuth.instance.signInWithCredential(credential);

      if (!mounted) return;

      // Nouveau utilisateur → setup du profil
      final isNew = result.additionalUserInfo?.isNewUser ?? false;
      if (isNew) {
        context.go(AppConstants.routeProfileSetup);
      } else {
        context.go(AppConstants.routeDriverHome);
      }
    } on FirebaseAuthException catch (e) {
      setState(() {
        _loading = false;
        _error = e.code == 'invalid-verification-code'
            ? 'Code incorrect. Vérifiez le SMS.'
            : 'Erreur : ${e.message}';
      });
      _pinController.clear();
    } catch (e) {
      setState(() { _loading = false; _error = 'Erreur inattendue'; });
    }
  }

  @override
  void dispose() {
    _pinController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    final defaultPinTheme = PinTheme(
      width: 52,
      height: 60,
      textStyle: theme.textTheme.headlineSmall?.copyWith(
        fontWeight: FontWeight.bold,
      ),
      decoration: BoxDecoration(
        border: Border.all(color: colorScheme.outline),
        borderRadius: BorderRadius.circular(12),
      ),
    );

    return Scaffold(
      appBar: AppBar(title: const Text('Vérification')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Code de vérification',
              style: theme.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Entrez le code à 6 chiffres envoyé au $_phone',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 40),
            Pinput(
              controller: _pinController,
              length: 6,
              defaultPinTheme: defaultPinTheme,
              focusedPinTheme: defaultPinTheme.copyWith(
                decoration: defaultPinTheme.decoration?.copyWith(
                  border: Border.all(color: VoyajColors.primary, width: 2),
                ),
              ),
              errorPinTheme: defaultPinTheme.copyWith(
                decoration: defaultPinTheme.decoration?.copyWith(
                  border: Border.all(color: colorScheme.error, width: 2),
                ),
              ),
              onCompleted: _verify,
              enabled: !_loading,
            ),
            if (_error != null) ...[
              const SizedBox(height: 16),
              Text(
                _error!,
                style: TextStyle(color: colorScheme.error),
                textAlign: TextAlign.center,
              ),
            ],
            const SizedBox(height: 32),
            if (_loading)
              const Center(child: CircularProgressIndicator())
            else
              FilledButton(
                onPressed: _pinController.text.length == 6
                    ? () => _verify(_pinController.text)
                    : null,
                child: const Text('Confirmer'),
              ),
          ],
        ),
      ),
    );
  }
}
