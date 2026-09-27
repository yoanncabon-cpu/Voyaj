import 'package:flutter/material.dart';

class AuthOtpScreen extends StatelessWidget {
  const AuthOtpScreen({super.key, required this.extra});
  final Map<String, dynamic> extra;

  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: AppBar(title: const Text('Verification')), body: const Center(child: Text('TODO')));
  }
}
