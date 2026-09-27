import 'package:flutter/material.dart';

class DisputeScreen extends StatelessWidget {
  const DisputeScreen({super.key, required this.rideId});
  final String rideId;

  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: AppBar(title: const Text('DisputeScreen')), body: const Center(child: Text('TODO')));
  }
}
