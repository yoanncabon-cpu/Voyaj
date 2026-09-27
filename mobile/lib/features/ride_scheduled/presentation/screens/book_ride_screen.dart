import 'package:flutter/material.dart';

class BookRideScreen extends StatelessWidget {
  const BookRideScreen({super.key, required this.rideId});
  final String rideId;

  @override
  Widget build(BuildContext context) {
    return Scaffold(appBar: AppBar(title: const Text('BookRideScreen')), body: const Center(child: Text('TODO')));
  }
}
